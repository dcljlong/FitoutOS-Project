from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
import xlrd
from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'fitout-os-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI(title="FitoutOS API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

NZ_REGION = os.environ.get("NZ_REGION", "auckland").strip().lower()

LABOUR_MATCH_GROUPS = [
    {"framing", "frame", "stud", "studs", "purlin", "purlins"},
    {"lining", "linings", "gib", "plasterboard", "board", "boards"},
    {"stopping", "stop", "skim", "skimcoat", "skimcoating"},
    {"ceiling", "ceilings", "furring", "grid", "tile", "tiles"},
    {"insulation", "insulate", "insulated", "batts", "batt"},
    {"aluminium", "aluminum", "glazing", "glazed", "glass"},
]

LABOUR_MATCH_STOPWORDS = {
    "labour", "labor", "works", "work", "scope", "package", "install", "installation",
    "supply", "fix", "fixing", "fit", "fitout", "commercial", "stage", "area", "areas",
    "zone", "zones", "internal", "external", "interior", "exterior", "project",
    "level", "levels", "toilet", "toilets", "wall", "walls", "ceiling", "ceilings"
}


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def tokenize_text(text: str) -> set:
    return {
        token
        for token in normalize_text(text).split()
        if len(token) >= 3 and token not in LABOUR_MATCH_STOPWORDS
    }


def get_scope_hours_value(scope_row: Dict[str, Any]) -> Optional[float]:
    try:
        approved = scope_row.get("approved_hours")
        if approved not in [None, ""]:
            return float(approved)
        quoted = scope_row.get("quoted_hours")
        if quoted not in [None, ""]:
            return float(quoted)
    except Exception:
        return None
    return None


def detect_task_family(text: str) -> str:
    t = normalize_text(text)

    if any(word in t for word in ["insulation", "insulate", "greenstuf", "autex", "batt", "batts"]):
        return "insulation"
    if any(word in t for word in ["stopping", "stop", "skim", "finish", "finishing"]):
        return "stopping"
    if any(word in t for word in ["lining", "linings", "gib", "plasterboard", "aqualine", "fyreline", "fyrelines"]):
        return "linings"
    if any(word in t for word in ["ceiling", "ceilings", "furring", "grid", "tile", "tiles"]):
        return "ceilings"
    if any(word in t for word in ["framing", "frame", "stud", "studs", "purlin", "purlins", "partition", "partitions"]):
        return "framing"
    if any(word in t for word in ["aluminium", "aluminum", "glazing", "glass"]):
        return "aluminium"

    return "other"


def detect_task_code_family(code_value: str) -> str:
    code_value = (code_value or "").strip().upper()

    if code_value.startswith("TS-"):
        return "framing"
    if code_value.startswith("WL-"):
        return "linings"
    if code_value.startswith("ST-"):
        return "stopping"
    if code_value.startswith("CL-"):
        return "ceilings"
    if code_value.startswith("IN-"):
        return "insulation"

    return "other"


def task_matches_scope(scope_item_name: str, task_name: str) -> bool:
    scope_norm = normalize_text(scope_item_name)
    task_norm = normalize_text(task_name)

    if not scope_norm or not task_norm:
        return False

    if scope_norm in task_norm or task_norm in scope_norm:
        return True

    scope_tokens = tokenize_text(scope_norm)
    task_tokens = tokenize_text(task_norm)

    if not scope_tokens or not task_tokens:
        return False

    if scope_tokens.intersection(task_tokens):
        return True

    for keyword_group in LABOUR_MATCH_GROUPS:
        if scope_tokens.intersection(keyword_group) and task_tokens.intersection(keyword_group):
            return True

    return False


def build_scope_task_allocation(scope_rows: List[Dict[str, Any]], task_rows: List[Dict[str, Any]]) -> Dict[str, float]:
    allocation_map: Dict[str, float] = {}

    eligible_tasks = [
        task_row for task_row in task_rows
        if task_row.get("is_internal", True)
        and task_row.get("planned_start")
        and task_row.get("planned_finish")
    ]

    for scope_row in scope_rows:
        hours = get_scope_hours_value(scope_row)
        if hours is None or hours <= 0:
            continue

        scope_item_name = scope_row.get("item")
        if not scope_item_name:
            continue

        matching_tasks = [
            task_row for task_row in eligible_tasks
            if task_matches_scope(scope_item_name, task_row.get("task_name", ""))
        ]

        if not matching_tasks:
            continue

        split_hours = hours / len(matching_tasks)

        for task_row in matching_tasks:
            task_id = task_row.get("id")
            if not task_id:
                continue
            allocation_map[task_id] = allocation_map.get(task_id, 0.0) + split_hours

    return allocation_map


def get_nz_public_holidays(year: int, region: str = NZ_REGION):
    region = (region or "auckland").strip().lower()

    holidays = set()

    def d(value: str):
        return datetime.fromisoformat(value).date()

    def nth_weekday(year_value: int, month: int, weekday: int, n: int):
        first = datetime(year_value, month, 1).date()
        offset = (weekday - first.weekday()) % 7
        return first + timedelta(days=offset + (n - 1) * 7)

    def last_weekday(year_value: int, month: int, weekday: int):
        if month == 12:
            next_month = datetime(year_value + 1, 1, 1).date()
        else:
            next_month = datetime(year_value, month + 1, 1).date()
        last = next_month - timedelta(days=1)
        offset = (last.weekday() - weekday) % 7
        return last - timedelta(days=offset)

    def easter_sunday(year_value: int):
        a = year_value % 19
        b = year_value // 100
        c = year_value % 100
        d1 = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d1 - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1
        return datetime(year_value, month, day).date()

    def observed(fixed_date):
        if fixed_date.weekday() == 5:
            return fixed_date + timedelta(days=2)
        if fixed_date.weekday() == 6:
            return fixed_date + timedelta(days=1)
        return fixed_date

    holidays.add(observed(datetime(year, 1, 1).date()))
    holidays.add(observed(datetime(year, 1, 2).date()))

    if region == "auckland":
        holidays.add(last_weekday(year, 1, 0))

    holidays.add(observed(datetime(year, 2, 6).date()))

    easter = easter_sunday(year)
    holidays.add(easter - timedelta(days=2))
    holidays.add(easter + timedelta(days=1))

    holidays.add(observed(datetime(year, 4, 25).date()))
    holidays.add(nth_weekday(year, 6, 0, 1))

    matariki_by_year = {
        2025: d("2025-06-20"),
        2026: d("2026-07-10"),
        2027: d("2027-06-25"),
        2028: d("2028-07-14"),
        2029: d("2029-07-06"),
        2030: d("2030-06-21")
    }
    if year in matariki_by_year:
        holidays.add(matariki_by_year[year])

    holidays.add(nth_weekday(year, 10, 0, 4))
    holidays.add(observed(datetime(year, 12, 25).date()))
    holidays.add(observed(datetime(year, 12, 26).date()))

    return holidays


def get_work_hours_for_day(day_value, allow_saturday: bool = False, region: str = NZ_REGION):
    if isinstance(day_value, datetime):
        day_value = day_value.date()

    if day_value in get_nz_public_holidays(day_value.year, region):
        return 0

    weekday = day_value.weekday()
    if weekday in (0, 1, 2, 3):
        return 9
    if weekday == 4:
        return 8
    if weekday == 5:
        return 8 if allow_saturday else 0
    return 0


def calculate_work_window_hours(start_date, finish_date, allow_saturday: bool = False, region: str = NZ_REGION):
    if not start_date or not finish_date:
        return {"days": 0, "hours": 0, "holiday_days": 0}

    if isinstance(start_date, datetime):
        start_date = start_date.date()
    if isinstance(finish_date, datetime):
        finish_date = finish_date.date()

    current = start_date
    work_days = 0
    work_hours = 0
    holiday_days = 0

    while current <= finish_date:
        hours = get_work_hours_for_day(current, allow_saturday=allow_saturday, region=region)
        if current in get_nz_public_holidays(current.year, region):
            holiday_days += 1
        if hours > 0:
            work_days += 1
            work_hours += hours
        current += timedelta(days=1)

    return {"days": work_days, "hours": work_hours, "holiday_days": holiday_days}


def calculate_required_crew(quoted_hours, available_hours):
    try:
        qh = float(quoted_hours or 0)
        ah = float(available_hours or 0)
        if qh <= 0 or ah <= 0:
            return None
        return round(qh / ah, 2)
    except Exception:
        return None


# ============== PYDANTIC MODELS ==============

class UserRole:
    ADMIN = "admin"
    PM = "pm"
    WORKER = "worker"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = UserRole.WORKER


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str = UserRole.WORKER
    created_at: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class JobCreate(BaseModel):
    max_crew: Optional[float] = None
    standard_crew: Optional[float] = None
    allow_saturday: Optional[bool] = False
    allow_overtime: Optional[bool] = False
    job_number: str
    job_name: str
    main_contractor: Optional[str] = None
    site_address: Optional[str] = None
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    status: str = "active"


class JobResponse(BaseModel):
    max_crew: Optional[float] = None
    standard_crew: Optional[float] = None
    allow_saturday: Optional[bool] = False
    allow_overtime: Optional[bool] = False
    id: str
    job_number: str
    job_name: str
    main_contractor: Optional[str] = None
    site_address: Optional[str] = None
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    status: str
    created_at: str = ""
    created_by: str
    latest_analysis: Optional[Dict[str, Any]] = None
    latest_analysis_id: Optional[str] = None
    latest_analysis_status: Optional[str] = None
    latest_analysis_at: Optional[str] = None


class MasterTaskCodeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    is_global_fallback: bool = False


class MasterTaskCodeResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    is_global_fallback: bool
    is_active: bool


class JobTaskCodeCreate(BaseModel):
    master_code_id: str
    custom_label: Optional[str] = None
    is_active: bool = True


class JobTaskCodeResponse(BaseModel):
    id: str
    job_id: str
    master_code_id: str
    code: str
    name: str
    custom_label: Optional[str] = None
    is_active: bool


class TaskCreate(BaseModel):
    job_id: str
    task_name: str
    task_type: Optional[str] = None
    linked_task_codes: List[str] = []
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    duration_days: Optional[int] = None
    predecessor_ids: List[str] = []
    owner_party: Optional[str] = None
    is_internal: bool = True
    subcontractor_id: Optional[str] = None
    zone_area: Optional[str] = None
    status: str = "planned"
    blockers: Optional[str] = None
    notes: Optional[str] = None
    quoted_hours: Optional[float] = None
    percent_complete: int
    locked: bool = False


class TaskResponse(BaseModel):
    id: str
    job_id: str
    task_name: str
    task_type: Optional[str] = None
    linked_task_codes: List[str]
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    duration_days: Optional[int] = None
    predecessor_ids: List[str]
    owner_party: Optional[str] = None
    is_internal: bool
    subcontractor_id: Optional[str] = None
    zone_area: Optional[str] = None
    status: str
    blockers: Optional[str] = None
    notes: Optional[str] = None
    quoted_hours: Optional[float] = None
    actual_hours: float = 0
    percent_complete: int
    locked: bool = False
    is_critical: bool = False
    created_at: str = ""


class ScopeItemApprovalUpdate(BaseModel):
    approved_hours: Optional[float] = None
    approval_status: str = "approved"


class ScopeItemResponse(BaseModel):
    id: str
    job_id: str
    item: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    quoted_hours: Optional[float] = None
    approved_hours: Optional[float] = None
    approval_status: str = "pending"
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    inclusions: Optional[List[str]] = None
    exclusions: Optional[List[str]] = None
    allowances: Optional[List[str]] = None
    confidence: Optional[str] = None
    task_id: Optional[str] = None
    created_at: str = ""


class TimesheetRowCreate(BaseModel):
    date: str
    job_id: Optional[str] = None
    task_code_id: str
    description: Optional[str] = None
    hours: float
    fallback_reason: Optional[str] = None


class TimesheetCreate(BaseModel):
    rows: List[TimesheetRowCreate]


class TimesheetRowResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    date: str
    job_id: Optional[str] = None
    job_number: Optional[str] = None
    job_name: Optional[str] = None
    task_code_id: str
    task_code: str
    task_code_name: str
    description: Optional[str] = None
    hours: float
    status: str
    fallback_reason: Optional[str] = None
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None


class SubcontractorCreate(BaseModel):
    company_name: str
    trade_type: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_preferred: bool = False
    is_nominated: bool = False
    notes: Optional[str] = None
    typical_lead_time_days: Optional[int] = None
    typical_crew_size: Optional[int] = None


class SubcontractorResponse(BaseModel):
    id: str
    company_name: str
    trade_type: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_preferred: bool
    is_nominated: bool
    notes: Optional[str] = None
    typical_lead_time_days: Optional[int] = None
    typical_crew_size: Optional[int] = None
    is_active: bool


class MaterialCreate(BaseModel):
    task_id: str
    name: str
    package_name: Optional[str] = None
    supplier: Optional[str] = None
    is_required: bool = True
    is_long_lead: bool = False
    order_lead_time_days: Optional[int] = None
    delivery_buffer_days: Optional[int] = None
    status: str = "required"


class MaterialResponse(BaseModel):
    id: str
    task_id: str
    name: str
    package_name: Optional[str] = None
    supplier: Optional[str] = None
    is_required: bool
    is_long_lead: bool
    order_lead_time_days: Optional[int] = None
    delivery_buffer_days: Optional[int] = None
    order_due_date: Optional[str] = None
    delivery_due_date: Optional[str] = None
    status: str


class AISettingsUpdate(BaseModel):
    openai_api_key: Optional[str] = None
    use_default_key: bool = True


class AISettingsResponse(BaseModel):
    use_default_key: bool
    has_custom_key: bool


# Delay tracking models
class DelayCreate(BaseModel):
    task_id: str
    delay_type: str  # internal, subcontractor, main_contractor, approvals, materials, weather, access, inspections
    delay_days: int
    description: Optional[str] = None
    caused_by: Optional[str] = None
    impact_description: Optional[str] = None


class DelayResponse(BaseModel):
    id: str
    task_id: str
    task_name: str
    job_id: str
    delay_type: str
    delay_days: int
    description: Optional[str] = None
    caused_by: Optional[str] = None
    impact_description: Optional[str] = None
    affected_tasks: List[str] = []
    created_at: str = ""
    resolved: bool = False
    resolved_at: Optional[str] = None


# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*roles):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)

    token = create_token(user_id, user_data.email, user_data.role)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=user["created_at"]
        )
    )


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user["id"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )


@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)


@api_router.get("/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


# ============== JOBS ENDPOINTS ==============

@api_router.post("/jobs", response_model=JobResponse)
async def create_job(job_data: JobCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    existing = await db.jobs.find_one({"job_number": job_data.job_number})
    if existing:
        raise HTTPException(status_code=400, detail="Job number already exists")

    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        **job_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    await db.jobs.insert_one(job)

    # Auto-assign standard task codes to the new job
    standard_codes = await db.master_task_codes.find(
        {"is_global_fallback": False, "is_active": True},
        {"_id": 0}
    ).to_list(100)

    job_codes_to_insert = []
    for master_code in standard_codes:
        job_code = {
            "id": str(uuid.uuid4()),
            "job_id": job_id,
            "master_code_id": master_code["id"],
            "code": master_code["code"],
            "name": master_code["name"],
            "custom_label": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        job_codes_to_insert.append(job_code)

    if job_codes_to_insert:
        await db.job_task_codes.insert_many(job_codes_to_insert)
        logger.info(f"Auto-assigned {len(job_codes_to_insert)} task codes to job {job_id}")

    return JobResponse(**job)


@api_router.get("/jobs", response_model=List[JobResponse])
async def get_jobs(user: dict = Depends(get_current_user)):
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(1000)
    return [JobResponse(**j) for j in jobs]


@api_router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(**job)


@api_router.put("/jobs/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, job_data: JobCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    existing = await db.jobs.find_one({"id": job_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = job_data.model_dump()
    await db.jobs.update_one({"id": job_id}, {"$set": update_data})

    updated = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return JobResponse(**updated)


@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(require_roles(UserRole.ADMIN))):
    result = await db.jobs.delete_one({"id": job_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted"}


# ============== MASTER TASK CODES ==============

@api_router.post("/task-codes/master", response_model=MasterTaskCodeResponse)
async def create_master_task_code(code_data: MasterTaskCodeCreate, user: dict = Depends(require_roles(UserRole.ADMIN))):
    existing = await db.master_task_codes.find_one({"code": code_data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Task code already exists")

    code_id = str(uuid.uuid4())
    code = {
        "id": code_id,
        **code_data.model_dump(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.master_task_codes.insert_one(code)
    return MasterTaskCodeResponse(**code)


@api_router.get("/task-codes/master", response_model=List[MasterTaskCodeResponse])
async def get_master_task_codes(user: dict = Depends(get_current_user)):
    codes = await db.master_task_codes.find({}, {"_id": 0}).to_list(1000)
    return [MasterTaskCodeResponse(**c) for c in codes]


@api_router.put("/task-codes/master/{code_id}", response_model=MasterTaskCodeResponse)
async def update_master_task_code(code_id: str, code_data: MasterTaskCodeCreate, user: dict = Depends(require_roles(UserRole.ADMIN))):
    existing = await db.master_task_codes.find_one({"id": code_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Task code not found")

    await db.master_task_codes.update_one({"id": code_id}, {"$set": code_data.model_dump()})
    updated = await db.master_task_codes.find_one({"id": code_id}, {"_id": 0})
    return MasterTaskCodeResponse(**updated)


@api_router.get("/task-codes/fallback", response_model=List[MasterTaskCodeResponse])
async def get_fallback_task_codes(user: dict = Depends(get_current_user)):
    """Get global fallback task codes for non-job-specific entries"""
    codes = await db.master_task_codes.find({"is_global_fallback": True, "is_active": True}, {"_id": 0}).to_list(100)
    return [MasterTaskCodeResponse(**c) for c in codes]


# ============== JOB TASK CODES ==============

@api_router.post("/jobs/{job_id}/task-codes", response_model=JobTaskCodeResponse)
async def add_job_task_code(job_id: str, code_data: JobTaskCodeCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    master_code = await db.master_task_codes.find_one({"id": code_data.master_code_id})
    if not master_code:
        raise HTTPException(status_code=404, detail="Master task code not found")

    existing = await db.job_task_codes.find_one({"job_id": job_id, "master_code_id": code_data.master_code_id})
    if existing:
        raise HTTPException(status_code=400, detail="Task code already added to this job")

    code_id = str(uuid.uuid4())
    job_code = {
        "id": code_id,
        "job_id": job_id,
        "master_code_id": code_data.master_code_id,
        "code": master_code["code"],
        "name": master_code["name"],
        "custom_label": code_data.custom_label,
        "is_active": code_data.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.job_task_codes.insert_one(job_code)
    return JobTaskCodeResponse(**job_code)


@api_router.get("/jobs/{job_id}/task-codes", response_model=List[JobTaskCodeResponse])
async def get_job_task_codes(job_id: str, active_only: bool = False, user: dict = Depends(get_current_user)):
    query = {"job_id": job_id}
    if active_only:
        query["is_active"] = True
    codes = await db.job_task_codes.find(query, {"_id": 0}).to_list(1000)
    return [JobTaskCodeResponse(**c) for c in codes]


@api_router.put("/jobs/{job_id}/task-codes/{code_id}", response_model=JobTaskCodeResponse)
async def update_job_task_code(job_id: str, code_id: str, code_data: JobTaskCodeCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    existing = await db.job_task_codes.find_one({"id": code_id, "job_id": job_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Job task code not found")

    await db.job_task_codes.update_one(
        {"id": code_id},
        {"$set": {"custom_label": code_data.custom_label, "is_active": code_data.is_active}}
    )
    updated = await db.job_task_codes.find_one({"id": code_id}, {"_id": 0})
    return JobTaskCodeResponse(**updated)


# ============== TASKS ==============

@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(task_data: TaskCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    job = await db.jobs.find_one({"id": task_data.job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    task_id = str(uuid.uuid4())
    task = {
        "id": task_id,
        **task_data.model_dump(),
        "actual_hours": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    await db.tasks.insert_one(task)
    return TaskResponse(**task)


@api_router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(job_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if job_id:
        query["job_id"] = job_id
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    return [TaskResponse(**t) for t in tasks]


@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(**task)


@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    existing = await db.tasks.find_one({"id": task_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_data.model_dump()
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return TaskResponse(**updated)


# ============== TIMESHEETS ==============

@api_router.post("/timesheets")
async def create_timesheet_entries(timesheet_data: TimesheetCreate, user: dict = Depends(get_current_user)):
    entries = []
    for row in timesheet_data.rows:
        # Validate job if provided
        job = None
        task_code_info = None

        if row.job_id:
            job = await db.jobs.find_one({"id": row.job_id}, {"_id": 0})
            if not job:
                raise HTTPException(status_code=400, detail=f"Job not found: {row.job_id}")

            # First check if it's a job-specific code
            job_code = await db.job_task_codes.find_one({"id": row.task_code_id, "job_id": row.job_id, "is_active": True}, {"_id": 0})
            if job_code:
                task_code_info = {"code": job_code["code"], "name": job_code.get("custom_label") or job_code["name"]}
            else:
                # Check if it's a fallback code (allowed even with job selected)
                master_code = await db.master_task_codes.find_one({"id": row.task_code_id, "is_global_fallback": True}, {"_id": 0})
                if master_code:
                    task_code_info = {"code": master_code["code"], "name": master_code["name"]}
                else:
                    # Check if task_code_id is actually a master code id that should be added to job
                    any_master = await db.master_task_codes.find_one({"id": row.task_code_id}, {"_id": 0})
                    if any_master:
                        task_code_info = {"code": any_master["code"], "name": any_master["name"]}
                    else:
                        raise HTTPException(status_code=400, detail=f"Task code not found or not active for this job")
        else:
            # No job - must use fallback code
            master_code = await db.master_task_codes.find_one({"id": row.task_code_id, "is_global_fallback": True}, {"_id": 0})
            if not master_code:
                # Also allow any master code as fallback when no job
                any_master = await db.master_task_codes.find_one({"id": row.task_code_id}, {"_id": 0})
                if any_master:
                    task_code_info = {"code": any_master["code"], "name": any_master["name"]}
                else:
                    raise HTTPException(status_code=400, detail="Invalid task code")
            else:
                task_code_info = {"code": master_code["code"], "name": master_code["name"]}

        entry_id = str(uuid.uuid4())
        entry = {
            "id": entry_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "date": row.date,
            "job_id": row.job_id,
            "job_number": job["job_number"] if job else None,
            "job_name": job["job_name"] if job else None,
            "task_code_id": row.task_code_id,
            "task_code": task_code_info["code"],
            "task_code_name": task_code_info["name"],
            "description": row.description,
            "hours": row.hours,
            "status": "draft",
            "fallback_reason": row.fallback_reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "submitted_at": None,
            "approved_at": None,
            "approved_by": None
        }
        entries.append(entry)

    if entries:
        await db.timesheets.insert_many(entries)
        for entry in entries:
            entry.pop('_id', None)

    return {"message": f"Created {len(entries)} timesheet entries", "entries": entries}


@api_router.get("/timesheets", response_model=List[TimesheetRowResponse])
async def get_timesheets(
    user_id: Optional[str] = None,
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}

    if user["role"] == UserRole.WORKER:
        query["user_id"] = user["id"]
    elif user_id:
        query["user_id"] = user_id

    if job_id:
        query["job_id"] = job_id
    if status:
        query["status"] = status
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}

    entries = await db.timesheets.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [TimesheetRowResponse(**e) for e in entries]


@api_router.post("/timesheets/submit")
async def submit_timesheets(entry_ids: List[str], user: dict = Depends(get_current_user)):
    result = await db.timesheets.update_many(
        {"id": {"$in": entry_ids}, "user_id": user["id"], "status": "draft"},
        {"$set": {"status": "submitted", "submitted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Submitted {result.modified_count} entries"}


@api_router.post("/timesheets/approve")
async def approve_timesheets(entry_ids: List[str], user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    entries = await db.timesheets.find(
        {"id": {"$in": entry_ids}, "status": "submitted"},
        {"_id": 0}
    ).to_list(1000)

    result = await db.timesheets.update_many(
        {"id": {"$in": entry_ids}, "status": "submitted"},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat(), "approved_by": user["id"]}}
    )

    for entry in entries:
        job_id = entry.get("job_id")
        hours = entry.get("hours") or 0
        task_code_id = entry.get("task_code_id")

        if not job_id or not task_code_id:
            continue

        task = await db.tasks.find_one(
            {
                "job_id": job_id,
                "linked_task_codes": task_code_id
            },
            {"_id": 0}
        )

        if not task:
            continue

        current_actual = task.get("actual_hours") or 0
        try:
            new_actual = float(current_actual) + float(hours)
        except Exception:
            continue

        await db.tasks.update_one(
            {"id": task["id"]},
            {"$set": {"actual_hours": round(new_actual, 2)}}
        )

    return {"message": f"Approved {result.modified_count} entries"}


@api_router.post("/timesheets/reject")
async def reject_timesheets(entry_ids: List[str], user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    result = await db.timesheets.update_many(
        {"id": {"$in": entry_ids}, "status": "submitted"},
        {"$set": {"status": "needs_correction"}}
    )
    return {"message": f"Rejected {result.modified_count} entries"}


@api_router.delete("/timesheets/{entry_id}")
async def delete_timesheet_entry(entry_id: str, user: dict = Depends(get_current_user)):
    entry = await db.timesheets.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if user["role"] == UserRole.WORKER and entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete other users' entries")

    if entry["status"] not in ["draft", "needs_correction"]:
        raise HTTPException(status_code=400, detail="Can only delete draft or needs_correction entries")

    await db.timesheets.delete_one({"id": entry_id})
    return {"message": "Entry deleted"}


# ============== SUBCONTRACTORS ==============

@api_router.post("/subcontractors", response_model=SubcontractorResponse)
async def create_subcontractor(sub_data: SubcontractorCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    sub_id = str(uuid.uuid4())
    sub = {
        "id": sub_id,
        **sub_data.model_dump(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.subcontractors.insert_one(sub)
    return SubcontractorResponse(**sub)


@api_router.get("/subcontractors", response_model=List[SubcontractorResponse])
async def get_subcontractors(user: dict = Depends(get_current_user)):
    subs = await db.subcontractors.find({}, {"_id": 0}).to_list(1000)
    return [SubcontractorResponse(**s) for s in subs]


@api_router.put("/subcontractors/{sub_id}", response_model=SubcontractorResponse)
async def update_subcontractor(sub_id: str, sub_data: SubcontractorCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    existing = await db.subcontractors.find_one({"id": sub_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Subcontractor not found")

    await db.subcontractors.update_one({"id": sub_id}, {"$set": sub_data.model_dump()})
    updated = await db.subcontractors.find_one({"id": sub_id}, {"_id": 0})
    return SubcontractorResponse(**updated)


# ============== MATERIALS ==============

@api_router.post("/materials", response_model=MaterialResponse)
async def create_material(mat_data: MaterialCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    task = await db.tasks.find_one({"id": mat_data.task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    mat_id = str(uuid.uuid4())

    order_due = None
    delivery_due = None
    if task.get("planned_start"):
        try:
            task_start = datetime.fromisoformat(task["planned_start"].replace('Z', '+00:00'))
            if mat_data.order_lead_time_days:
                order_due = (task_start - timedelta(days=mat_data.order_lead_time_days)).isoformat()
            if mat_data.delivery_buffer_days:
                delivery_due = (task_start - timedelta(days=mat_data.delivery_buffer_days)).isoformat()
        except Exception:
            pass

    material = {
        "id": mat_id,
        **mat_data.model_dump(),
        "order_due_date": order_due,
        "delivery_due_date": delivery_due,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.materials.insert_one(material)
    return MaterialResponse(**material)


@api_router.get("/materials", response_model=List[MaterialResponse])
async def get_materials(task_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if task_id:
        query["task_id"] = task_id
    materials = await db.materials.find(query, {"_id": 0}).to_list(1000)
    return [MaterialResponse(**m) for m in materials]


@api_router.put("/materials/{mat_id}", response_model=MaterialResponse)
async def update_material(mat_id: str, mat_data: MaterialCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    existing = await db.materials.find_one({"id": mat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Material not found")

    await db.materials.update_one({"id": mat_id}, {"$set": mat_data.model_dump()})
    updated = await db.materials.find_one({"id": mat_id}, {"_id": 0})
    return MaterialResponse(**updated)


# ============== DELAY TRACKING ==============

@api_router.post("/delays", response_model=DelayResponse)
async def create_delay(delay_data: DelayCreate, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    """Record a delay and calculate roll-on effects"""
    task = await db.tasks.find_one({"id": delay_data.task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    delay_id = str(uuid.uuid4())

    affected_task_ids = []
    all_tasks = await db.tasks.find({"job_id": task["job_id"]}, {"_id": 0}).to_list(1000)

    if task.get("planned_finish"):
        task_end = datetime.fromisoformat(task["planned_finish"].replace('Z', '+00:00'))
        for t in all_tasks:
            if t["id"] != task["id"] and t.get("planned_start"):
                t_start = datetime.fromisoformat(t["planned_start"].replace('Z', '+00:00'))
                if t_start >= task_end:
                    affected_task_ids.append(t["id"])
                    if t["status"] not in ["blocked", "complete"]:
                        await db.tasks.update_one(
                            {"id": t["id"]},
                            {"$set": {"status": "at_risk"}}
                        )

    new_status = "delayed" if delay_data.delay_type in ["internal", "subcontractor"] else "blocked"
    await db.tasks.update_one(
        {"id": delay_data.task_id},
        {"$set": {
            "status": new_status,
            "blockers": delay_data.description
        }}
    )

    delay = {
        "id": delay_id,
        "task_id": delay_data.task_id,
        "task_name": task["task_name"],
        "job_id": task["job_id"],
        "delay_type": delay_data.delay_type,
        "delay_days": delay_data.delay_days,
        "description": delay_data.description,
        "caused_by": delay_data.caused_by,
        "impact_description": delay_data.impact_description,
        "affected_tasks": affected_task_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
        "resolved": False,
        "resolved_at": None
    }
    await db.delays.insert_one(delay)

    return DelayResponse(**delay)


@api_router.get("/delays", response_model=List[DelayResponse])
async def get_delays(
    job_id: Optional[str] = None,
    task_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if job_id:
        query["job_id"] = job_id
    if task_id:
        query["task_id"] = task_id
    if resolved is not None:
        query["resolved"] = resolved

    delays = await db.delays.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [DelayResponse(**d) for d in delays]


@api_router.post("/delays/{delay_id}/resolve")
async def resolve_delay(delay_id: str, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    """Mark a delay as resolved"""
    delay = await db.delays.find_one({"id": delay_id})
    if not delay:
        raise HTTPException(status_code=404, detail="Delay not found")

    await db.delays.update_one(
        {"id": delay_id},
        {"$set": {
            "resolved": True,
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    task = await db.tasks.find_one({"id": delay["task_id"]})
    if task and task["status"] in ["delayed", "blocked"]:
        await db.tasks.update_one(
            {"id": delay["task_id"]},
            {"$set": {
                "status": "planned",
                "resource_analysis": {
                    "available_days_standard": None,
                    "available_hours_standard": None,
                    "available_days_with_saturday": None,
                    "available_hours_with_saturday": None,
                    "holiday_days": None,
                    "required_crew_standard": None,
                    "required_crew_with_saturday": None,
                    "requires_saturday": False,
                    "programme_feasible": None
                },
                "blockers": None
            }}
        )

    return {"message": "Delay resolved"}


@api_router.get("/delays/impact-analysis/{task_id}")
async def get_delay_impact(task_id: str, delay_days: int = 1, user: dict = Depends(get_current_user)):
    """Analyze the potential impact of a delay on downstream tasks"""
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    all_tasks = await db.tasks.find({"job_id": task["job_id"]}, {"_id": 0}).to_list(1000)

    affected = []
    if task.get("planned_finish"):
        task_end = datetime.fromisoformat(task["planned_finish"].replace('Z', '+00:00'))
        new_end = task_end + timedelta(days=delay_days)

        for t in all_tasks:
            if t["id"] != task["id"] and t.get("planned_start"):
                t_start = datetime.fromisoformat(t["planned_start"].replace('Z', '+00:00'))
                if task_end <= t_start <= new_end:
                    affected.append({
                        "task_id": t["id"],
                        "task_name": t["task_name"],
                        "planned_start": t["planned_start"],
                        "impact_days": delay_days,
                        "new_start": (t_start + timedelta(days=delay_days)).isoformat()
                    })

    return {
        "delayed_task": {
            "id": task["id"],
            "name": task["task_name"],
            "current_finish": task.get("planned_finish"),
            "new_finish": (datetime.fromisoformat(task["planned_finish"].replace('Z', '+00:00')) + timedelta(days=delay_days)).isoformat() if task.get("planned_finish") else None
        },
        "delay_days": delay_days,
        "affected_tasks": affected,
        "total_affected": len(affected)
    }


# ============== FILE UPLOAD & AI ANALYSIS ==============

@api_router.post("/jobs/{job_id}/upload")
async def upload_job_files(
    job_id: str,
    files: List[UploadFile] = File(...),
    user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_upload_dir = UPLOAD_DIR / job_id
    job_upload_dir.mkdir(exist_ok=True)

    uploaded_files = []
    for file in files:
        file_id = str(uuid.uuid4())
        file_ext = Path(file.filename).suffix
        file_path = job_upload_dir / f"{file_id}{file_ext}"

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        file_record = {
            "id": file_id,
            "job_id": job_id,
            "filename": file.filename,
            "filepath": str(file_path),
            "content_type": file.content_type,
            "size": len(content),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": user["id"]
        }
        await db.job_files.insert_one(file_record)
        uploaded_files.append({"id": file_id, "filename": file.filename})

    return {"message": f"Uploaded {len(uploaded_files)} files", "files": uploaded_files}


@api_router.delete("/jobs/{job_id}/files/{file_id}")
async def delete_job_file(
    job_id: str,
    file_id: str,
    user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    file_record = await db.job_files.find_one({"job_id": job_id, "id": file_id}, {"_id": 0})
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    filepath = file_record.get("filepath")
    if filepath and os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception:
            pass

    await db.job_files.delete_one({"job_id": job_id, "id": file_id})

    return {"message": "File deleted"}


@api_router.get("/jobs/{job_id}/files")
async def get_job_files(job_id: str, user: dict = Depends(get_current_user)):
    files = await db.job_files.find({"job_id": job_id}, {"_id": 0}).to_list(100)
    return files


@api_router.post("/jobs/{job_id}/analyze")
async def analyze_job_files(job_id: str, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):

    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    files = await db.job_files.find({"job_id": job_id}, {"_id": 0}).to_list(100)

    extracted_text = ""

    for f in files:
        try:
            filepath = f["filepath"].lower()

            if filepath.endswith(".xls"):
                wb = xlrd.open_workbook(f["filepath"])
                for sheet in wb.sheets():
                    for row_idx in range(min(sheet.nrows, 100)):
                        row_values = sheet.row_values(row_idx)
                        extracted_text += " | ".join([str(v) for v in row_values if str(v).strip()]) + "\n"

            else:
                with open(f["filepath"], "rb") as fh:
                    content = fh.read().decode(errors="ignore")
                    extracted_text += content[:5000]

        except Exception:
            pass

    if not extracted_text.strip():
        extracted_text = "No readable document content."

    prompt = f"""
You are a construction project analyst for commercial interior fitouts.

CRITICAL RULE:
Only extract tasks that belong to the contractor performing the interior fitout scope.
Do NOT generate generic project lifecycle tasks.

STRICT SCOPE FILTER:
Only include activities clearly belonging to this contractor's package such as:
- steel stud framing
- wall linings
- stopping
- ceilings
- insulation
- aluminium / glazing where explicitly mentioned

DO NOT generate tasks for:
- site establishment
- demolition
- services rough-in
- painting unless explicitly included
- final clean
- defects or touchups
- handover
- material delivery
- work by other trades

If an activity is not clearly awarded to this contractor, exclude it.

Return JSON with:
job_summary
scope_items
proposed_tasks
proposed_task_codes
proposed_programme
materials
subcontractors
dependencies
risks

The programme must ONLY include tasks directly related to the contractor's quoted scope.

Example:

proposed_programme: [
  {{
    "id": "prog-001",
    "name": "Site measure and set out",
    "phase": "Preliminaries",
    "trade": "Site",
    "duration": 1,
    "duration_unit": "days",
    "depends_on": [],
    "confidence": "high"
  }},
  {{
    "id": "prog-002",
    "name": "Delivery and staging of materials",
    "phase": "Preliminaries",
    "trade": "Logistics",
    "duration": 1,
    "duration_unit": "days",
    "depends_on": ["prog-001"],
    "confidence": "high"
  }},
  {{
    "id": "prog-003",
    "name": "Install gib board wall linings",
    "phase": "Construction",
    "trade": "Drywall/Gib Fixing",
    "duration": 5,
    "duration_unit": "days",
    "depends_on": ["prog-002"],
    "confidence": "high"
  }}
]

DOCUMENT CONTENT:
{extracted_text}
"""

    resp = openai_client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )

    text = resp.output[0].content[0].text.strip()

    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        analysis = json.loads(text)
    except Exception:
        analysis = {"raw_response": text}

    analysis_record = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "analysis": analysis,
        "status": "pending_review",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }

    await db.job_analyses.insert_one(analysis_record)

    await db.jobs.update_one(
        {"id": job_id},
        {
            "$set": {
                "latest_analysis": analysis,
                "latest_analysis_id": analysis_record["id"],
                "latest_analysis_status": "pending_review",
                "latest_analysis_at": analysis_record["created_at"]
            }
        }
    )

    return {"analysis_id": analysis_record["id"], "analysis": analysis}


@api_router.get("/jobs/{job_id}/programme")
async def get_job_programme(job_id: str, user: dict = Depends(get_current_user)):
    programme = await db.job_programme.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    return programme


@api_router.get("/jobs/{job_id}/analysis")
async def get_job_analysis(job_id: str, user: dict = Depends(get_current_user)):
    analysis = await db.job_analyses.find_one({"job_id": job_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this job")
    return analysis


@api_router.get("/jobs/{job_id}/resource-analysis")
async def get_job_resource_analysis(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    allow_saturday = bool(job.get("allow_saturday", False))

    tasks = await db.tasks.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    scope_rows = await db.scope_items.find({"job_id": job_id}, {"_id": 0}).to_list(1000)

    approved_scope_hours = 0.0
    for scope_row in scope_rows:
        try:
            approved_scope_hours += float(scope_row.get("approved_hours") or 0)
        except Exception:
            pass

    def norm(text):
        if not text:
            return ""
        text = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
        return " ".join(text.split())

    def detect_family(text):
        t = norm(text)

        if any(word in t for word in ["insulation", "insulate", "greenstuf", "autex", "batt", "batts"]):
            return "insulation"
        if any(word in t for word in ["stopping", "stop", "skim", "finish", "finishing"]):
            return "stopping"
        if any(word in t for word in ["lining", "linings", "gib", "plasterboard", "aqualine", "fyreline", "fyrelines"]):
            return "linings"
        if any(word in t for word in ["ceiling", "ceilings", "furring", "grid", "tile", "tiles"]):
            return "ceilings"
        if any(word in t for word in ["framing", "frame", "stud", "studs", "purlin", "purlins", "partition", "partitions"]):
            return "framing"
        if any(word in t for word in ["aluminium", "aluminum", "glazing", "glass"]):
            return "aluminium"

        return "other"

    for t in tasks:
        t["quoted_hours"] = 0

    for scope in scope_rows:
        hours = scope.get("approved_hours")
        if hours in [None, ""]:
            hours = scope.get("quoted_hours")
        if hours in [None, ""]:
            continue

        try:
            hours = float(hours)
        except Exception:
            continue

        scope_text = norm(scope.get("item"))
        scope_family = detect_family(scope_text)

        exact_matches = []
        preferred_matches = []
        family_matches = []

        for task in tasks:
            if not task.get("planned_start") or not task.get("planned_finish"):
                continue

            task_text = norm(task.get("task_name"))
            task_family = detect_family(task_text)

            if scope_text and scope_text in task_text:
                exact_matches.append(task)
                continue

            if "between steel purlins" in scope_text and "between steel purlins" in task_text:
                preferred_matches.append(task)
                continue

            if "it walls and partitions" in scope_text and "it walls and partitions" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "wall linings" in scope_text and "toilet" in scope_text and "toilet walls and ceilings" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "wall linings" in scope_text and "it walls" in scope_text and "exterior walls" in scope_text and "it and exterior walls" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "stopping" in scope_text and "toilet" in scope_text and "toilet walls and ceilings" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "stopping" in scope_text and "it walls" in scope_text and "exterior walls" in scope_text and "it and exterior walls" in task_text:
                preferred_matches.append(task)
                continue

            if "ceiling framing" in scope_text and "toilet" in scope_text and "ceiling framing to toilets" in task_text:
                preferred_matches.append(task)
                continue

            if "insulation" in scope_text and "insulation to walls" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family:
                family_matches.append(task)

        if exact_matches:
            split = hours / len(exact_matches)

            for m in exact_matches:
                current = m.get("quoted_hours") or 0
                m["quoted_hours"] = round(float(current) + float(split), 2)

            continue

        if preferred_matches:
            split = hours / len(preferred_matches)

            for m in preferred_matches:
                current = m.get("quoted_hours") or 0
                m["quoted_hours"] = round(float(current) + float(split), 2)

            continue

        if family_matches:
            split = hours / len(family_matches)

            for m in family_matches:
                current = m.get("quoted_hours") or 0
                m["quoted_hours"] = round(float(current) + float(split), 2)

    analysis_rows = []
    total_quoted_hours = 0.0
    total_actual_hours = 0.0
    total_standard_hours = 0.0
    total_saturday_hours = 0.0

    for task in tasks:
        planned_start = task.get("planned_start")
        planned_finish = task.get("planned_finish")
        quoted_hours = task.get("quoted_hours")

        standard_window = {"days": 0, "hours": 0, "holiday_days": 0}
        saturday_window = {"days": 0, "hours": 0, "holiday_days": 0}
        required_crew_standard = None
        required_crew_with_saturday = None
        requires_saturday = False
        programme_feasible = None

        if planned_start and planned_finish:
            try:
                start_dt = datetime.fromisoformat(planned_start)
                finish_dt = datetime.fromisoformat(planned_finish)

                standard_window = calculate_work_window_hours(start_dt, finish_dt, allow_saturday=allow_saturday)
                saturday_window = calculate_work_window_hours(start_dt, finish_dt, allow_saturday=True)

                required_crew_standard = calculate_required_crew(quoted_hours, standard_window["hours"])
                required_crew_with_saturday = calculate_required_crew(quoted_hours, saturday_window["hours"])

                if quoted_hours is not None:
                    try:
                        qh = float(quoted_hours)
                        if qh > 0:
                            if standard_window["hours"] >= qh:
                                programme_feasible = "ON_TRACK"
                            elif saturday_window["hours"] >= qh:
                                programme_feasible = "SATURDAY_REQUIRED"
                                requires_saturday = True
                            else:
                                programme_feasible = "OVERALLOCATED"
                                requires_saturday = True
                    except Exception:
                        pass
            except Exception:
                pass

        try:
            total_quoted_hours += float(quoted_hours or 0)
            total_actual_hours += float(task.get("actual_hours") or 0)
        except Exception:
            pass

        total_standard_hours += float(standard_window["hours"] or 0)
        total_saturday_hours += float(saturday_window["hours"] or 0)

        analysis_rows.append({
            "task_id": task.get("id"),
            "task_name": task.get("task_name"),
            "planned_start": planned_start,
            "planned_finish": planned_finish,
            "quoted_hours": quoted_hours,
            "actual_hours": task.get("actual_hours", 0),
            "hours_variance": (task.get("actual_hours", 0) - (quoted_hours or 0)) if quoted_hours else None,
            "percent_hours_used": round((task.get("actual_hours", 0) / quoted_hours) * 100,1) if quoted_hours else None,
            "available_days_standard": standard_window["days"],
            "available_hours_standard": standard_window["hours"],
            "available_days_with_saturday": saturday_window["days"],
            "available_hours_with_saturday": saturday_window["hours"],
            "holiday_days": standard_window["holiday_days"],
            "required_crew_standard": required_crew_standard,
            "required_crew_with_saturday": required_crew_with_saturday,
            "requires_saturday": requires_saturday,
            "programme_feasible": programme_feasible
        })

    baseline_hours = approved_scope_hours if approved_scope_hours > 0 else total_quoted_hours

    overall_status = "NO_QUOTED_HOURS"
    if baseline_hours > 0:
        if total_standard_hours >= baseline_hours:
            overall_status = "ON_TRACK"
        elif total_saturday_hours >= baseline_hours:
            overall_status = "SATURDAY_REQUIRED"
        else:
            overall_status = "OVERALLOCATED"

    return {
        "job_id": job_id,
        "job_number": job.get("job_number"),
        "job_name": job.get("job_name"),
        "region": NZ_REGION,
        "hours_rule": {
            "mon_to_thu": 9,
            "friday": 8,
            "saturday_backup_only": 8
        },
        "summary": {
            "total_tasks": len(analysis_rows),
            "total_quoted_hours": round(total_quoted_hours, 2),
            "total_actual_hours": round(total_actual_hours, 2),
            "total_hours_variance": round(total_actual_hours - baseline_hours, 2),
            "percent_hours_used": round((total_actual_hours / baseline_hours) * 100, 1) if baseline_hours > 0 else None,
            "total_approved_scope_hours": round(approved_scope_hours, 2),
            "baseline_hours_used": round(baseline_hours, 2),
            "total_available_hours_standard": round(total_standard_hours, 2),
            "total_available_hours_with_saturday": round(total_saturday_hours, 2),
            "overall_status": overall_status
        },
        "tasks": analysis_rows
    }

@api_router.get("/jobs/{job_id}/resource-load-timeline")
async def get_job_resource_load_timeline(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    tasks = await db.tasks.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    scope_rows = await db.scope_items.find({"job_id": job_id}, {"_id": 0}).to_list(1000)

    approved_scope_hours = 0.0
    for scope_row in scope_rows:
        try:
            approved_scope_hours += float(scope_row.get("approved_hours") or 0)
        except Exception:
            pass

    def norm(text):
        if not text:
            return ""
        text = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
        return " ".join(text.split())

    def detect_family(text):
        t = norm(text)

        if any(word in t for word in ["insulation", "insulate", "greenstuf", "autex", "batt", "batts"]):
            return "insulation"
        if any(word in t for word in ["stopping", "stop", "skim", "finish", "finishing"]):
            return "stopping"
        if any(word in t for word in ["lining", "linings", "gib", "plasterboard", "aqualine", "fyreline", "fyrelines"]):
            return "linings"
        if any(word in t for word in ["ceiling", "ceilings", "furring", "grid", "tile", "tiles"]):
            return "ceilings"
        if any(word in t for word in ["framing", "frame", "stud", "studs", "purlin", "purlins", "partition", "partitions"]):
            return "framing"
        if any(word in t for word in ["aluminium", "aluminum", "glazing", "glass"]):
            return "aluminium"

        return "other"

    for t in tasks:
        t["quoted_hours"] = 0

    for scope in scope_rows:
        hours = scope.get("approved_hours")
        if hours in [None, ""]:
            hours = scope.get("quoted_hours")
        if hours in [None, ""]:
            continue

        try:
            hours = float(hours)
        except Exception:
            continue

        scope_text = norm(scope.get("item"))
        scope_family = detect_family(scope_text)

        exact_matches = []
        preferred_matches = []
        family_matches = []

        for task in tasks:
            if not task.get("planned_start") or not task.get("planned_finish"):
                continue

            task_text = norm(task.get("task_name"))
            task_family = detect_family(task_text)

            if scope_text and scope_text in task_text:
                exact_matches.append(task)
                continue

            if "between steel purlins" in scope_text and "between steel purlins" in task_text:
                preferred_matches.append(task)
                continue

            if "it walls and partitions" in scope_text and "it walls and partitions" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "wall linings" in scope_text and "toilet" in scope_text and "toilet walls and ceilings" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "wall linings" in scope_text and "it walls" in scope_text and "exterior walls" in scope_text and "it and exterior walls" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "stopping" in scope_text and "toilet" in scope_text and "toilet walls and ceilings" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family and "stopping" in scope_text and "it walls" in scope_text and "exterior walls" in scope_text and "it and exterior walls" in task_text:
                preferred_matches.append(task)
                continue

            if "ceiling framing" in scope_text and "toilet" in scope_text and "ceiling framing to toilets" in task_text:
                preferred_matches.append(task)
                continue

            if "insulation" in scope_text and "insulation to walls" in task_text:
                preferred_matches.append(task)
                continue

            if task_family == scope_family:
                family_matches.append(task)

        if exact_matches:
            split = hours / len(exact_matches)
            for m in exact_matches:
                current = m.get("quoted_hours") or 0
                m["quoted_hours"] = round(float(current) + float(split), 2)
            continue

        if preferred_matches:
            split = hours / len(preferred_matches)
            for m in preferred_matches:
                current = m.get("quoted_hours") or 0
                m["quoted_hours"] = round(float(current) + float(split), 2)
            continue

        if family_matches:
            split = hours / len(family_matches)
            for m in family_matches:
                current = m.get("quoted_hours") or 0
                m["quoted_hours"] = round(float(current) + float(split), 2)

    allow_saturday = bool(job.get("allow_saturday") or False)
    allow_overtime = bool(job.get("allow_overtime") or False)
    max_crew = float(job.get("max_crew") or 0) if job.get("max_crew") not in [None, ""] else None
    standard_crew = float(job.get("standard_crew") or 0) if job.get("standard_crew") not in [None, ""] else None
    effective_crew_limit = max_crew if max_crew and max_crew > 0 else standard_crew if standard_crew and standard_crew > 0 else None

    timeline_map = {}
    total_required_hours = 0.0
    total_available_hours = 0.0

    for task in tasks:
        planned_start = task.get("planned_start")
        planned_finish = task.get("planned_finish")
        quoted_hours = float(task.get("quoted_hours") or 0)

        if not planned_start or not planned_finish or quoted_hours <= 0:
            continue

        try:
            start_dt = datetime.fromisoformat(planned_start)
            finish_dt = datetime.fromisoformat(planned_finish)
        except Exception:
            continue

        standard_window = calculate_work_window_hours(start_dt, finish_dt, allow_saturday=allow_saturday)
        available_hours = float(standard_window.get("hours") or 0)
        available_days = int(standard_window.get("days") or 0)

        if available_days <= 0:
            continue

        required_per_day = quoted_hours / available_days
        available_per_day = available_hours / available_days if available_hours > 0 else 0.0
        overtime_available_per_day = available_per_day + 2.0 if allow_overtime and available_per_day > 0 else available_per_day
        crew_required = calculate_required_crew(quoted_hours, available_hours)

        current_day = start_dt.date()
        finish_day = finish_dt.date()

        while current_day <= finish_day:
            weekday = current_day.weekday()
            day_hours = 0
            if weekday in [0, 1, 2, 3]:
                day_hours = 9
            elif weekday == 4:
                day_hours = 8

            if day_hours > 0:
                day_key = current_day.isoformat()
                if day_key not in timeline_map:
                    timeline_map[day_key] = {
                        "date": day_key,
                        "hours_required": 0.0,
                        "hours_available": 0.0,
                        "crew_capacity": float(effective_crew_limit or 0),
                        "crew_required": 0.0,
                        "task_count": 0,
                    }

                timeline_map[day_key]["hours_required"] += required_per_day
                timeline_map[day_key]["hours_available"] += overtime_available_per_day
                timeline_map[day_key]["crew_required"] += float(crew_required or 0)
                timeline_map[day_key]["task_count"] += 1

            current_day += timedelta(days=1)

    timeline_rows = []
    for day_key in sorted(timeline_map.keys()):
        row = timeline_map[day_key]
        hours_required = round(float(row["hours_required"]), 2)
        hours_available = round(float(row["hours_available"]), 2)
        crew_required = round(float(row["crew_required"]), 2)
        overload = round(hours_required - hours_available, 2)
        overtime_required = overload > 0 and allow_overtime
        crew_capacity = round(float(row.get("crew_capacity") or 0), 2)
        crew_over = round(crew_required - crew_capacity, 2) if crew_capacity > 0 else 0

        timeline_rows.append({
            "date": day_key,
            "hours_required": hours_required,
            "hours_available": hours_available,
            "crew_required": crew_required,
            "crew_capacity": crew_capacity,
            "task_count": row["task_count"],
            "overload_hours": overload if overload > 0 else 0,
            "overtime_allowed": allow_overtime,
            "overtime_required": overtime_required,
            "crew_over": crew_over if crew_over > 0 else 0,
            "status": "OVERCREW" if crew_capacity > 0 and crew_required > crew_capacity else ("OVERTIME_REQUIRED" if overtime_required else ("OVERALLOCATED" if overload > 0 else "ON_TRACK")),
        })

        total_required_hours += hours_required
        total_available_hours += hours_available

    return {
        "job_id": job_id,
        "job_number": job.get("job_number"),
        "job_name": job.get("job_name"),
        "summary": {
            "days": len(timeline_rows),
            "total_required_hours": round(total_required_hours, 2),
            "total_available_hours": round(total_available_hours, 2),
            "total_overload_hours": round(max(total_required_hours - total_available_hours, 0), 2),
        },
        "timeline": timeline_rows,
    }
@api_router.post("/jobs/{job_id}/analysis/confirm")
async def confirm_job_analysis(
    job_id: str,
    confirmed_data: Dict[str, Any],
    user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    """Confirm and apply the AI analysis to create actual job data"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    created_items = {
        "tasks": 0,
        "task_codes": 0,
        "materials": 0,
        "scope_items": 0
    }

    await db.job_programme.delete_many({"job_id": job_id})
    await db.job_task_codes.delete_many({"job_id": job_id})
    await db.scope_items.delete_many({"job_id": job_id})
    await db.tasks.delete_many({"job_id": job_id, "is_internal": True})

    if "programme" in confirmed_data:
        await db.job_programme.delete_many({"job_id": job_id})

        for item in confirmed_data["programme"]:
            programme_row = {
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "name": item.get("name"),
                "phase": item.get("phase"),
                "trade": item.get("trade"),
                "duration": item.get("duration"),
                "duration_unit": item.get("duration_unit"),
                "depends_on": item.get("depends_on", []),
                "confidence": item.get("confidence", "manual"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.job_programme.insert_one(programme_row)
        await generate_tasks_from_programme(job_id, user)

    if "task_codes" in confirmed_data:
        for code_data in confirmed_data["task_codes"]:
            if isinstance(code_data, str):
                code_data = {"code": code_data}
            master_code = await db.master_task_codes.find_one({"code": code_data["code"]})
            if not master_code:
                master_code = {
                    "id": str(uuid.uuid4()),
                    "code": code_data["code"],
                    "name": code_data.get("name") or code_data["code"].replace("-", " ").replace("_", " ").title(),
                    "description": code_data.get("reason"),
                    "trade": code_data.get("trade"),
                    "phase": code_data.get("phase"),
                    "is_global_fallback": False,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.master_task_codes.insert_one(master_code)
            if master_code:
                existing = await db.job_task_codes.find_one({"job_id": job_id, "master_code_id": master_code["id"]})
                if not existing:
                    job_code = {
                        "id": str(uuid.uuid4()),
                        "job_id": job_id,
                        "master_code_id": master_code["id"],
                        "code": master_code["code"],
                        "name": master_code["name"],
                        "custom_label": None,
                        "is_active": True,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.job_task_codes.insert_one(job_code)
                    created_items["task_codes"] += 1

    # Raw confirmed_data["tasks"] insert disabled.
    # Tasks must be generated from programme to avoid duplicates.
    if "scope_items" in confirmed_data:
        for scope_data in confirmed_data["scope_items"]:
            if isinstance(scope_data, str):
                scope_data = {"item": scope_data}
            scope_item = {
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "item": scope_data.get("item"),
                "quantity": scope_data.get("quantity"),
                "unit": scope_data.get("unit"),
                "quoted_hours": scope_data.get("quoted_hours") or 8,
                "approved_hours": scope_data.get("quoted_hours") or 8,
                "approval_status": "pending",
                "approved_at": None,
                "approved_by": None,
                "inclusions": scope_data.get("inclusions"),
                "exclusions": scope_data.get("exclusions"),
                "allowances": scope_data.get("allowances"),
                "confidence": scope_data.get("confidence", "medium"),
                "task_id": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.scope_items.insert_one(scope_item)
            created_items["scope_items"] += 1

    scope_rows = await db.scope_items.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    task_rows = await db.tasks.find({"job_id": job_id, "is_internal": True}, {"_id": 0}).to_list(1000)
    job_task_codes = await db.job_task_codes.find({"job_id": job_id, "is_active": True}, {"_id": 0}).to_list(1000)

    for task_row in task_rows:
        if task_row.get("linked_task_codes"):
            continue

        task_family = detect_task_family(task_row.get("task_name", ""))
        if task_family == "other":
            continue

        matched_code_ids = [
            code_row.get("id")
            for code_row in job_task_codes
            if code_row.get("id") and detect_task_code_family(code_row.get("code", "")) == task_family
        ]

        if matched_code_ids:
            await db.tasks.update_one(
                {"id": task_row["id"]},
                {"$set": {"linked_task_codes": matched_code_ids}}
            )
            task_row["linked_task_codes"] = matched_code_ids

    allocation_map = build_scope_task_allocation(scope_rows, task_rows)

    # Fallback: even distribution if allocation fails
    if not allocation_map:
        total_hours = sum(float(s.get("approved_hours") or 0) for s in scope_rows)
        if total_hours > 0 and len(task_rows) > 0:
            per_task = total_hours / len(task_rows)
            allocation_map = {t["id"]: per_task for t in task_rows}

    for task_row in task_rows:
        task_id = task_row.get("id")
        if not task_id:
            continue
        allocated_hours = allocation_map.get(task_id)
        if allocated_hours is None:
            continue

        await db.tasks.update_one(
            {"id": task_id, "job_id": job_id},
            {"$set": {"quoted_hours": round(allocated_hours, 2)}}
        )

    await db.job_analyses.update_one(
        {"job_id": job_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"message": "Analysis confirmed and applied", "created": created_items}


@api_router.post("/jobs/{job_id}/scope-items/apply-hours-to-tasks")
async def apply_scope_hours_to_tasks(job_id: str, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    scope_rows = await db.scope_items.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    task_rows = await db.tasks.find({"job_id": job_id, "is_internal": True}, {"_id": 0}).to_list(1000)
    job_task_codes = await db.job_task_codes.find({"job_id": job_id, "is_active": True}, {"_id": 0}).to_list(1000)

    for task_row in task_rows:
        if task_row.get("linked_task_codes"):
            continue

        task_family = detect_task_family(task_row.get("task_name", ""))
        if task_family == "other":
            continue

        matched_code_ids = [
            code_row.get("id")
            for code_row in job_task_codes
            if code_row.get("id") and detect_task_code_family(code_row.get("code", "")) == task_family
        ]

        if matched_code_ids:
            await db.tasks.update_one(
                {"id": task_row["id"]},
                {"$set": {"linked_task_codes": matched_code_ids}}
            )
            task_row["linked_task_codes"] = matched_code_ids

    allocation_map = build_scope_task_allocation(scope_rows, task_rows)

    # Fallback: even distribution if allocation fails
    if not allocation_map:
        total_hours = sum(float(s.get("approved_hours") or 0) for s in scope_rows)
        if total_hours > 0 and len(task_rows) > 0:
            per_task = total_hours / len(task_rows)
            allocation_map = {t["id"]: per_task for t in task_rows}

    applied = 0
    for task_row in task_rows:
        task_id = task_row.get("id")
        if not task_id:
            continue
        allocated_hours = allocation_map.get(task_id)
        if allocated_hours is None:
            continue

        await db.tasks.update_one(
            {"id": task_id, "job_id": job_id},
            {"$set": {"quoted_hours": round(allocated_hours, 2)}}
        )
        applied += 1

    return {
        "job_id": job_id,
        "applied_task_hours": applied,
        "allocation_tasks": {
            task_id: round(hours, 2)
            for task_id, hours in allocation_map.items()
        }
    }


@api_router.get("/jobs/{job_id}/scope-items", response_model=List[ScopeItemResponse])
async def get_job_scope_items(job_id: str, user: dict = Depends(get_current_user)):
    rows = await db.scope_items.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    return [ScopeItemResponse(**r) for r in rows]


@api_router.put("/jobs/{job_id}/scope-items/{scope_item_id}/approve", response_model=ScopeItemResponse)
async def approve_scope_item_hours(
    job_id: str,
    scope_item_id: str,
    update_data: ScopeItemApprovalUpdate,
    user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    existing = await db.scope_items.find_one({"id": scope_item_id, "job_id": job_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Scope item not found")

    approved_hours = update_data.approved_hours
    if approved_hours is None:
        approved_hours = existing.get("approved_hours")
        if approved_hours is None:
            approved_hours = existing.get("quoted_hours")

    payload = {
        "approved_hours": approved_hours,
        "approval_status": update_data.approval_status,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": user["id"]
    }

    await db.scope_items.update_one(
        {"id": scope_item_id, "job_id": job_id},
        {"$set": payload}
    )

    updated = await db.scope_items.find_one({"id": scope_item_id, "job_id": job_id}, {"_id": 0})
    return ScopeItemResponse(**updated)


@api_router.post("/jobs/{job_id}/programme/generate-tasks")
async def generate_tasks_from_programme(
    job_id: str,
    user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))
):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    programme = await db.job_programme.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    if not programme:
        raise HTTPException(status_code=404, detail="No programme found for this job")

    existing_generated_tasks = await db.tasks.find(
        {"job_id": job_id, "source_programme_id": {"$exists": True}},
        {"_id": 0}
    ).to_list(1000)

    existing_by_source = {
        t.get("source_programme_id"): t
        for t in existing_generated_tasks
        if t.get("source_programme_id")
    }

    job_task_codes = await db.job_task_codes.find(
        {"job_id": job_id, "is_active": True},
        {"_id": 0}
    ).to_list(1000)

    created_tasks = []
    programme_id_to_task_id = {}
    seen_programme_ids = set()

    for item in programme:
        source_programme_id = item.get("id")
        seen_programme_ids.add(source_programme_id)

        existing_task = existing_by_source.get(source_programme_id)
        task_id = existing_task["id"] if existing_task else str(uuid.uuid4())
        programme_id_to_task_id[source_programme_id] = task_id

        duration_value = item.get("duration")
        try:
            duration_days = int(float(duration_value)) if duration_value not in [None, ""] else None
        except Exception:
            duration_days = None

        task_family = detect_task_family(item.get("name", ""))
        auto_linked_code_ids = [
            code_row.get("id")
            for code_row in job_task_codes
            if code_row.get("id") and detect_task_code_family(code_row.get("code", "")) == task_family
        ]

        task_data = {
            "job_id": job_id,
            "task_name": item.get("name", "Unnamed Task"),
            "source_programme_id": source_programme_id,
            "task_type": item.get("phase"),
            "linked_task_codes": existing_task.get("linked_task_codes") if existing_task and existing_task.get("linked_task_codes") else auto_linked_code_ids,
            "planned_start": existing_task.get("planned_start") if existing_task else None,
            "planned_finish": existing_task.get("planned_finish") if existing_task else None,
            "duration_days": duration_days,
            "predecessor_ids": [],
            "owner_party": item.get("trade"),
            "is_internal": existing_task.get("is_internal", True) if existing_task else True,
            "subcontractor_id": existing_task.get("subcontractor_id") if existing_task else None,
            "zone_area": existing_task.get("zone_area") if existing_task else None,
            "status": existing_task.get("status", "planned") if existing_task else "planned",
            "blockers": existing_task.get("blockers") if existing_task else None,
            "notes": existing_task.get("notes") if existing_task else f"Generated from programme item {source_programme_id}",
            "quoted_hours": existing_task.get("quoted_hours") if existing_task else None,
            "actual_hours": existing_task.get("actual_hours", 0) if existing_task else 0,
            "percent_complete": existing_task.get("percent_complete", 0) if existing_task else 0,
            "locked": existing_task.get("locked", False) if existing_task else False,
            "is_critical": False,
        }

        if existing_task:
            await db.tasks.update_one(
                {"id": task_id},
                {"$set": task_data}
            )
        else:
            task = {
                "id": task_id,
                **task_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"]
            }
            created_tasks.append(task)

    for source_programme_id, task_id in programme_id_to_task_id.items():
        source_item = next((p for p in programme if p["id"] == source_programme_id), None)
        if source_item:
            predecessor_ids = [
                programme_id_to_task_id[dep_id]
                for dep_id in source_item.get("depends_on", [])
                if dep_id in programme_id_to_task_id
            ]
            await db.tasks.update_one(
                {"id": task_id},
                {"$set": {"predecessor_ids": predecessor_ids}}
            )

    obsolete_ids = [
        t["id"] for t in existing_generated_tasks
        if t.get("source_programme_id") not in seen_programme_ids
    ]
    if obsolete_ids:
        await db.tasks.delete_many({"id": {"$in": obsolete_ids}})
    if created_tasks:
        await db.tasks.insert_many(created_tasks)

    all_generated_tasks = await db.tasks.find(
        {"job_id": job_id, "source_programme_id": {"$exists": True}},
        {"_id": 0}
    ).to_list(1000)

    task_map = {t["id"]: t for t in all_generated_tasks}
    successors = {}
    # AUTO SCHEDULE TASKS

    start_date = datetime.now()

    for task in all_generated_tasks:
        if not task.get("planned_start"):
            duration = task.get("duration_days") or 1
            planned_start = start_date
            planned_finish = start_date + timedelta(days=duration)

            await db.tasks.update_one(
                {"id": task["id"]},
                {"$set": {
                    "planned_start": planned_start.isoformat(),
                    "planned_finish": planned_finish.isoformat()
                }}
            )

            start_date = planned_finish
    for t in all_generated_tasks:
        for pred in t.get("predecessor_ids", []):
            if pred not in successors:
                successors[pred] = []
            successors[pred].append(t["id"])

    longest_to = {}

    def get_duration(task, allow_overtime=False):
        try:
            base_duration = int(task.get("duration_days") or 1)
        except Exception:
            base_duration = 1

        if base_duration < 1:
            base_duration = 1

        if allow_overtime:
            return max(1, math.ceil((base_duration * 8.0) / 10.0))

        return base_duration

    def calc_longest(task_id):
        if task_id in longest_to:
            return longest_to[task_id]

        task = task_map[task_id]
        preds = task.get("predecessor_ids", [])
        if not preds:
            longest_to[task_id] = get_duration(task, bool(job.get("allow_overtime") or False))
        else:
            longest_to[task_id] = max(calc_longest(pred) for pred in preds) + get_duration(task)
        return longest_to[task_id]

    for task_id in task_map.keys():
        calc_longest(task_id)

    if job.get("planned_start"):
        try:
            project_start = datetime.fromisoformat(job["planned_start"])
        except Exception:
            project_start = None
    else:
        project_start = None

    allow_saturday = bool(job.get("allow_saturday", False))

    def is_workday(dt, allow_saturday=False):
        weekday = dt.weekday()
        if weekday == 6:
            return False
        if weekday == 5 and not allow_saturday:
            return False
        return True

    def add_workdays(start_dt, workdays, allow_saturday=False):
        current = start_dt
        remaining = int(workdays or 0)

        if remaining <= 0:
            while not is_workday(current, allow_saturday):
                current += timedelta(days=1)
            return current

        while not is_workday(current, allow_saturday):
            current += timedelta(days=1)

        while remaining > 0:
            current += timedelta(days=1)
            if is_workday(current, allow_saturday):
                remaining -= 1

        return current

    if project_start:
        for task_id, task in task_map.items():
            preds = task.get("predecessor_ids", [])
            if preds:
                start_offset = max(longest_to.get(pred, 0) for pred in preds)
            else:
                start_offset = 0

            duration_days = get_duration(task, bool(job.get("allow_overtime") or False))
            task_start_dt = add_workdays(project_start, start_offset, allow_saturday)
            task_finish_dt = add_workdays(task_start_dt, max(duration_days - 1, 0), allow_saturday)
            planned_start = task_start_dt.date().isoformat()
            planned_finish = task_finish_dt.date().isoformat()

            await db.tasks.update_one(
                {"id": task_id},
                {"$set": {
                    "planned_start": planned_start,
                    "planned_finish": planned_finish
                }}
            )

    def each_workday(start_dt, finish_dt, allow_saturday=False):
        current = start_dt
        while current <= finish_dt:
            if is_workday(current, allow_saturday):
                yield current
            current += timedelta(days=1)

    def get_task_crew_required(task):
        try:
            val = task.get("assigned_crew")
            if val not in [None, ""]:
                return float(val)
        except Exception:
            pass
        try:
            val = task.get("crew_required")
            if val not in [None, ""]:
                return float(val)
        except Exception:
            pass
        return 1.0

    if project_start:
        max_crew = float(job.get("max_crew") or 0) if job.get("max_crew") not in [None, ""] else None
        standard_crew = float(job.get("standard_crew") or 0) if job.get("standard_crew") not in [None, ""] else None
        allow_overtime = bool(job.get("allow_overtime") or False)
        effective_crew_limit = max_crew if max_crew and max_crew > 0 else standard_crew if standard_crew and standard_crew > 0 else None
        if effective_crew_limit and effective_crew_limit > 0 and allow_overtime:
            effective_crew_limit = round(effective_crew_limit * 1.25, 2)

        if effective_crew_limit and effective_crew_limit > 0:
            daily_crew_load = {}

            def get_phase_rank(task):
                phase_value = str(task.get("task_type") or "").strip().lower()
                phase_order = {
                    "preliminaries": 1,
                    "preliminary": 1,
                    "construction": 2,
                    "finishing": 3,
                    "finish": 3,
                    "closeout": 4,
                    "handover": 5,
                }
                return phase_order.get(phase_value, 99)

            sorted_task_ids = sorted(
                task_map.keys(),
                key=lambda tid: (
                    0 if task_map[tid].get("is_critical") else 1,
                    get_phase_rank(task_map[tid]),
                    datetime.fromisoformat(task_map[tid]["planned_start"]) if task_map[tid].get("planned_start") else datetime.max,
                    tid
                )
            )

            for task_id in sorted_task_ids:
                task = task_map[task_id]

                if task.get("locked"):
                    continue

                if str(task.get("status") or "").lower() == "complete":
                    continue

                try:
                    if int(task.get("percent_complete") or 0) > 0:
                        continue
                except Exception:
                    pass

                if not task.get("planned_start") or not task.get("planned_finish"):
                    continue

                try:
                    task_start_dt = datetime.fromisoformat(task["planned_start"])
                    task_finish_dt = datetime.fromisoformat(task["planned_finish"])
                except Exception:
                    continue

                task_crew = get_task_crew_required(task)
                if task_crew <= 0:
                    task_crew = 1.0

                preds = task.get("predecessor_ids", [])
                if preds:
                    pred_finish_dates = []
                    for pred_id in preds:
                        pred_task = task_map.get(pred_id)
                        if pred_task and pred_task.get("planned_finish"):
                            try:
                                pred_finish_dates.append(datetime.fromisoformat(pred_task["planned_finish"]))
                            except Exception:
                                pass
                    if pred_finish_dates:
                        earliest_start_dt = add_workdays(max(pred_finish_dates), 1, allow_saturday)
                        if task_start_dt < earliest_start_dt:
                            task_start_dt = earliest_start_dt

                duration_days = get_duration(task, bool(job.get("allow_overtime") or False))

                while True:
                    candidate_finish_dt = add_workdays(task_start_dt, max(duration_days - 1, 0), allow_saturday)
                    would_overload = False


                    for day_dt in each_workday(task_start_dt, candidate_finish_dt, allow_saturday):
                        day_key = day_dt.date().isoformat()
                        existing_load = float(daily_crew_load.get(day_key, 0))
                        if (existing_load + task_crew) > effective_crew_limit:
                            would_overload = True
                            break

                    if not would_overload:
                        break

                    task_start_dt = add_workdays(task_start_dt, 1, allow_saturday)

                task_finish_dt = add_workdays(task_start_dt, max(duration_days - 1, 0), allow_saturday)

                for day_dt in each_workday(task_start_dt, task_finish_dt, allow_saturday):
                    day_key = day_dt.date().isoformat()
                    daily_crew_load[day_key] = float(daily_crew_load.get(day_key, 0)) + float(task_crew)

                task["planned_start"] = task_start_dt.date().isoformat()
                task["planned_finish"] = task_finish_dt.date().isoformat()

                await db.tasks.update_one(
                    {"id": task_id},
                    {"$set": {
                        "planned_start": task["planned_start"],
                        "planned_finish": task["planned_finish"]
                    }}
                )

    if longest_to:
        max_path = max(longest_to.values())
        critical_ids = {task_id for task_id, total in longest_to.items() if total == max_path}
        await db.tasks.update_many(
            {"job_id": job_id, "source_programme_id": {"$exists": True}},
            {"$set": {"is_critical": False}}
        )
        await db.tasks.update_many(
            {"id": {"$in": list(critical_ids)}},
            {"$set": {"is_critical": True}}
        )

    return {
        "message": "Tasks generated from programme",
        "created_count": len(created_tasks)
    }


# ============== AI SETTINGS ==============

@api_router.get("/settings/ai", response_model=AISettingsResponse)
async def get_ai_settings(user: dict = Depends(require_roles(UserRole.ADMIN))):
    settings = await db.ai_settings.find_one({}, {"_id": 0})
    if not settings:
        return AISettingsResponse(use_default_key=True, has_custom_key=False)
    return AISettingsResponse(
        use_default_key=settings.get("use_default_key", True),
        has_custom_key=bool(settings.get("openai_api_key"))
    )


@api_router.put("/settings/ai", response_model=AISettingsResponse)
async def update_ai_settings(settings_data: AISettingsUpdate, user: dict = Depends(require_roles(UserRole.ADMIN))):
    update = {"use_default_key": settings_data.use_default_key}
    if settings_data.openai_api_key:
        update["openai_api_key"] = settings_data.openai_api_key

    await db.ai_settings.update_one({}, {"$set": update}, upsert=True)

    settings = await db.ai_settings.find_one({}, {"_id": 0})
    return AISettingsResponse(
        use_default_key=settings.get("use_default_key", True),
        has_custom_key=bool(settings.get("openai_api_key"))
    )


# ============== DASHBOARD / REPORTS ==============

@api_router.get("/dashboard/summary")
async def get_dashboard_summary(user: dict = Depends(get_current_user)):
    """Get dashboard summary data"""
    now = datetime.now(timezone.utc)
    week_from_now = (now + timedelta(days=7)).isoformat()

    active_jobs = await db.jobs.count_documents({"status": "active"})

    tasks_starting_soon = await db.tasks.count_documents({
        "planned_start": {"$lte": week_from_now},
        "status": "planned"
    })

    blocked_tasks = await db.tasks.count_documents({"status": "blocked"})

    pending_approvals = await db.timesheets.count_documents({"status": "submitted"})

    materials_attention = await db.materials.count_documents({
        "status": {"$in": ["required", "takeoff_needed"]}
    })

    week_ago = (now - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"date": {"$gte": week_ago[:10]}, "status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$hours"}}}
    ]
    hours_result = await db.timesheets.aggregate(pipeline).to_list(1)
    total_hours_week = hours_result[0]["total"] if hours_result else 0

    return {
        "active_jobs": active_jobs,
        "tasks_starting_soon": tasks_starting_soon,
        "blocked_tasks": blocked_tasks,
        "pending_approvals": pending_approvals,
        "materials_attention": materials_attention,
        "total_hours_week": total_hours_week
    }


@api_router.get("/reports/hours-by-job")
async def get_hours_by_job(user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    """Get hours summary by job"""
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {
            "_id": "$job_id",
            "job_number": {"$first": "$job_number"},
            "job_name": {"$first": "$job_name"},
            "total_hours": {"$sum": "$hours"}
        }},
        {"$sort": {"total_hours": -1}}
    ]
    results = await db.timesheets.aggregate(pipeline).to_list(100)

    for r in results:
        if r["_id"]:
            tasks = await db.tasks.find({"job_id": r["_id"]}, {"_id": 0, "quoted_hours": 1}).to_list(1000)
            r["quoted_hours"] = sum(t.get("quoted_hours", 0) or 0 for t in tasks)
            r["variance"] = r["total_hours"] - r["quoted_hours"] if r["quoted_hours"] else None

    return results


@api_router.get("/reports/hours-by-code")
async def get_hours_by_code(job_id: Optional[str] = None, user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.PM))):
    """Get hours summary by task code"""
    match = {"status": "approved"}
    if job_id:
        match["job_id"] = job_id

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$task_code",
            "task_code_name": {"$first": "$task_code_name"},
            "total_hours": {"$sum": "$hours"},
            "entry_count": {"$sum": 1}
        }},
        {"$sort": {"total_hours": -1}}
    ]
    results = await db.timesheets.aggregate(pipeline).to_list(100)
    return results


# ============== SEED DATA ==============

@api_router.post("/seed/task-codes")
async def seed_master_task_codes(user: dict = Depends(require_roles(UserRole.ADMIN))):
    """Seed default master task codes"""
    default_codes = [
        {"code": "101", "name": "Suspended Ceilings / 2-way", "category": "Ceilings", "is_global_fallback": False},
        {"code": "102", "name": "Suspended Ceilings / 1-way", "category": "Ceilings", "is_global_fallback": False},
        {"code": "103", "name": "Partition Walls", "category": "Walls", "is_global_fallback": False},
        {"code": "104", "name": "Aluminium", "category": "Framing", "is_global_fallback": False},
        {"code": "105", "name": "Plasterboard / Linings", "category": "Walls", "is_global_fallback": False},
        {"code": "106", "name": "Stopping", "category": "Finishing", "is_global_fallback": False},
        {"code": "107", "name": "Insulation", "category": "Insulation", "is_global_fallback": False},
        {"code": "108", "name": "Bulkheads", "category": "Ceilings", "is_global_fallback": False},
        {"code": "109", "name": "Fire Rating", "category": "Compliance", "is_global_fallback": False},
        {"code": "110", "name": "Acoustic Treatment", "category": "Acoustic", "is_global_fallback": False},
        {"code": "P&G", "name": "Prelims & General", "category": "General", "is_global_fallback": True},
        {"code": "P&Gs", "name": "P&G Site", "category": "General", "is_global_fallback": True},
        {"code": "P&Gt", "name": "P&G Travel", "category": "General", "is_global_fallback": True},
        {"code": "Tools", "name": "Tools & Equipment", "category": "General", "is_global_fallback": True},
        {"code": "Safety", "name": "Safety & Compliance", "category": "General", "is_global_fallback": True},
        {"code": "Staff", "name": "Staff / Admin", "category": "General", "is_global_fallback": True},
        {"code": "R/M", "name": "Repairs & Maintenance", "category": "General", "is_global_fallback": True},
        {"code": "Admin", "name": "Administration", "category": "General", "is_global_fallback": True},
        {"code": "Yard", "name": "Yard / Workshop", "category": "General", "is_global_fallback": True},
    ]

    created = 0
    for code_data in default_codes:
        existing = await db.master_task_codes.find_one({"code": code_data["code"]})
        if not existing:
            code = {
                "id": str(uuid.uuid4()),
                **code_data,
                "description": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.master_task_codes.insert_one(code)
            created += 1

    return {"message": f"Created {created} task codes"}


# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


































































@app.get("/reports/summary")
async def reports_summary():

    total_jobs = await db.jobs.count_documents({})
    total_tasks = await db.tasks.count_documents({})
    total_timesheets = await db.timesheets.count_documents({})

    return {
        "total_jobs": total_jobs,
        "total_tasks": total_tasks,
        "total_timesheets": total_timesheets
    }







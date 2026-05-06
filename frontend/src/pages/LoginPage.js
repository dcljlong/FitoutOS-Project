import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import fitoutLogo from '../assets/fitoutos-logo.png';
import loginBackground from '../assets/login-background.jpg';

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        if (item?.message) return item.message;
        return null;
      })
      .filter(Boolean);

    return messages.length > 0 ? messages.join(' | ') : fallback;
  }

  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || fallback;
  }

  return error?.message || fallback;
};

export default function LoginPage() {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'worker'
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Welcome back!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register(registerForm.name, registerForm.email, registerForm.password, registerForm.role);
      toast.success('Account created successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050914]">
      <div
        className="absolute inset-0 bg-cover bg-center scale-[1.02]"
        style={{
          backgroundImage: `url(${loginBackground})`,
          filter: 'saturate(1.1) contrast(1.04) brightness(1.05)'
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.04),rgba(0,0,0,0.34)),linear-gradient(90deg,rgba(2,6,14,0.56),rgba(2,6,14,0.16),rgba(2,6,14,0.50))]"
        aria-hidden="true"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute right-4 top-4 z-20 text-white/80 hover:bg-white/10 hover:text-white"
        data-testid="theme-toggle"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-5 text-center text-white">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[#f5be50]">
              A Long Line Product
            </p>
            <img
              src={fitoutLogo}
              alt="FitoutOS logo"
              className="mx-auto mt-3 h-32 w-32 object-contain drop-shadow-2xl"
            />
            <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em] font-['Manrope']">
              FitoutOS
            </h1>
            <p className="mt-1 text-sm font-bold uppercase tracking-[0.22em] text-white/75">
              Programme & Project Control
            </p>
          </div>

          <Card className="border border-[#f5be50]/30 bg-[#050914]/78 text-white shadow-[0_28px_90px_rgba(0,0,0,0.50)] backdrop-blur-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-['Manrope'] text-white">
                Commercial Fitout Hub
              </CardTitle>
              <CardDescription className="text-white/68">
                Sign in or create access for project planning, task control, and resource tracking.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/10">
                  <TabsTrigger value="login" data-testid="login-tab">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-white/86">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        required
                        data-testid="login-email"
                        className="bg-white/94 text-slate-950 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-white/86">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        required
                        data-testid="login-password"
                        className="bg-white/94 text-slate-950 placeholder:text-slate-500"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-[#f5be50] text-[#050914] hover:bg-[#ffd166] font-black uppercase tracking-[0.08em]"
                      disabled={loading}
                      data-testid="login-submit"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="text-white/86">Full Name</Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="John Smith"
                        autoComplete="name"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                        required
                        data-testid="register-name"
                        className="bg-white/94 text-slate-950 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-white/86">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        required
                        data-testid="register-email"
                        className="bg-white/94 text-slate-950 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-role" className="text-white/86">Role</Label>
                      <Select
                        value={registerForm.role}
                        onValueChange={(value) => setRegisterForm({ ...registerForm, role: value })}
                      >
                        <SelectTrigger data-testid="register-role" className="bg-white/94 text-slate-950">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="worker">Worker</SelectItem>
                          <SelectItem value="pm">Project Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-white/86">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a password"
                        autoComplete="new-password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        required
                        data-testid="register-password"
                        className="bg-white/94 text-slate-950 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-confirm" className="text-white/86">Confirm Password</Label>
                      <Input
                        id="register-confirm"
                        type="password"
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                        required
                        data-testid="register-confirm"
                        className="bg-white/94 text-slate-950 placeholder:text-slate-500"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-[#f5be50] text-[#050914] hover:bg-[#ffd166] font-black uppercase tracking-[0.08em]"
                      disabled={loading}
                      data-testid="register-submit"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
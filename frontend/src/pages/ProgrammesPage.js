import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProgrammesPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(`/jobs/${jobId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Programmes</h1>
        <p className="text-muted-foreground">Select a programme view</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Master Programme</h3>
            <Button onClick={() => navigate(`/jobs/${jobId}/gantt`)}>
              Open Gantt
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Resource Analysis</h3>
            <Button onClick={() => navigate(`/resource-analysis/${jobId}`)}>
              Open Analysis
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">2 Week Lookahead</h3>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  REPORT_CATEGORIES,
  REPORT_TEMPLATES,
  ReportTemplateCard,
  GenerateReportModal,
} from "@/components/reports/ReportComponents";
import type { ReportTemplate } from "@/components/reports/ReportComponents";

interface ReportsHubClientProps {
  stations: { id: string; name: string }[];
}

export default function ReportsHubClient({ stations }: ReportsHubClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  const filteredTemplates = selectedCategory
    ? REPORT_TEMPLATES.filter((t) => t.category === selectedCategory)
    : REPORT_TEMPLATES;

  const handleGenerate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setModalOpen(true);
  };

  return (
    <>
      {/* Category cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "0.875rem",
          marginBottom: "1.75rem",
        }}
      >
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.label ? null : cat.label)}
            style={{
              background: selectedCategory === cat.label ? "var(--ax-blue)" : "var(--ax-white)",
              color: selectedCategory === cat.label ? "var(--ax-white)" : "var(--ax-blue)",
              border: `1px solid ${selectedCategory === cat.label ? "var(--ax-blue)" : "var(--ax-border)"}`,
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <div style={{ marginBottom: "0.5rem" }}><Icon size={22} /></div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>{cat.label}</div>
            <div
              style={{
                fontSize: "0.75rem",
                opacity: 0.7,
                lineHeight: 1.4,
              }}
            >
              {cat.description}
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                marginTop: "0.5rem",
                opacity: 0.5,
              }}
            >
              {cat.count} {cat.count === 1 ? "template" : "templates"}
            </div>
          </button>
          );
        })}
      </div>

      {/* Template heading */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--ax-blue)" }}>
          {selectedCategory ? `${selectedCategory} Templates` : "All Report Templates"}
        </h2>
        {selectedCategory && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setSelectedCategory(null)}
          >
            Show All
          </button>
        )}
      </div>

      {/* Template grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "0.875rem",
        }}
      >
        {filteredTemplates.map((template) => (
          <ReportTemplateCard
            key={template.id}
            template={template}
            onGenerate={handleGenerate}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="dash-panel" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--ax-muted)" }}>
          No templates available in this category.
        </div>
      )}

      {/* Generate modal */}
      <GenerateReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        template={selectedTemplate}
        stations={stations}
      />
    </>
  );
}

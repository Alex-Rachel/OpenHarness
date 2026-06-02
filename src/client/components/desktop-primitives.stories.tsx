import type { Meta, StoryObj } from "@storybook/react";
import { ProductEmptyState, ProductHeader, ProductPill, ProductSurface } from "./product-shell-primitives";

function DesktopPrimitiveGallery({ interactive = false }: { interactive?: boolean }) {
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="desktop-panel overflow-hidden">
        <div className="desktop-panel-header">
          <span>Panel</span>
          <span className="text-desktop-text-secondary">desktop-theme.css</span>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button className="desktop-btn desktop-btn-primary" type="button">
              Primary Action
            </button>
            <button className="desktop-btn desktop-btn-secondary" type="button">
              Secondary Action
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-desktop-text-muted">
              Input
            </span>
            <input
              className="desktop-input w-full"
              defaultValue="Existing desktop input styling"
              placeholder="Search agents, sessions, tasks"
            />
          </label>

          <div className="space-y-1">
            <div
              className={`desktop-list-item rounded-md border border-desktop-border ${interactive ? "active" : ""}`}
            >
              <span className="flex-1">Selected workspace</span>
              <span className="desktop-badge desktop-badge-accent">8</span>
            </div>
            <div className="desktop-list-item rounded-md border border-transparent">
              <span className="flex-1">Queued automation</span>
              <span className="desktop-badge desktop-badge-warning">3</span>
            </div>
            <div className="desktop-list-item rounded-md border border-transparent">
              <span className="flex-1">Completed runs</span>
              <span className="desktop-badge desktop-badge-success">12</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-desktop-border bg-desktop-bg-secondary p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-desktop-text-muted">
          Tokens In Use
        </div>
        <div className="space-y-3">
          {[
            "--dt-button-primary",
            "--dt-button-secondary",
            "--dt-input-bg",
            "--dt-panel-bg",
            "--dt-badge-bg",
            "--dt-badge-warning-bg",
            "--dt-badge-success-bg",
          ].map((token) => (
            <div key={token} className="flex items-center justify-between gap-3 rounded-lg border border-desktop-border bg-desktop-bg-primary px-3 py-2">
              <code className="text-[11px] text-desktop-text-primary">{token}</code>
              <div
                className="h-5 w-12 rounded border border-desktop-border"
                style={{ backgroundColor: `var(${token})` }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Foundations/Desktop Primitives",
  tags: ["autodocs"],
  parameters: {
    desktopTheme: true,
    layout: "fullscreen",
  },
  render: (args) => <DesktopPrimitiveGallery interactive={args.interactive} />,
  argTypes: {
    interactive: {
      control: "boolean",
    },
  },
  args: {
    interactive: false,
  },
} satisfies Meta<{ interactive: boolean }>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InteractiveStates: Story = {
  args: {
    interactive: true,
  },
};

export const DarkMode: Story = {
  globals: {
    colorMode: "dark",
  },
};

export const ProductConsole: Story = {
  render: () => (
    <div className="desktop-theme min-h-screen bg-desktop-bg-primary p-8 text-desktop-text-primary">
      <ProductHeader
        eyebrow="Routa Console"
        title="Coordinate agents with less chrome."
        description="Shared tokens, quiet surfaces, and named semantic states keep the product UI cohesive across shell, workspace, and diagnostics views."
        actions={(
          <>
            <ProductPill tone="success">Runtime ready</ProductPill>
            <ProductPill tone="warning">Codebase pending</ProductPill>
          </>
        )}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ProductSurface className="p-4">
          <div className="text-sm font-semibold">Surface</div>
          <p className="mt-2 text-sm leading-6 text-desktop-text-secondary">
            Default card chrome uses product shell tokens.
          </p>
        </ProductSurface>
        <ProductSurface className="p-4">
          <div className="text-sm font-semibold">Semantic</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ProductPill tone="neutral">Neutral</ProductPill>
            <ProductPill tone="info">Info</ProductPill>
            <ProductPill tone="danger">Danger</ProductPill>
          </div>
        </ProductSurface>
        <ProductEmptyState
          title="No active runs"
          description="Empty states stay calm and readable without page-local palettes."
        />
      </div>
    </div>
  ),
};

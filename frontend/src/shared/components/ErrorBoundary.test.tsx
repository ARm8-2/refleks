import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { initializeI18n } from "@/i18n";
import { productionBoundaryFixture } from "@/test/fixtures/acceptanceDtos";
import { ErrorFallback } from "./ErrorBoundary";

beforeAll(async () => {
  await initializeI18n("en");
});

describe("ErrorFallback", () => {
  it("hides raw diagnostics in production mode", () => {
    const onDismiss = vi.fn();
    render(
      <ErrorFallback
        error={productionBoundaryFixture.error}
        componentStack={productionBoundaryFixture.componentStack}
        showDiagnostics={false}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(
      screen.queryByText(productionBoundaryFixture.error.message),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(productionBoundaryFixture.componentStack),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Development diagnostics")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps diagnostics inside the marked development detail view", () => {
    render(
      <ErrorFallback
        error={new Error("fixture diagnostics")}
        componentStack="at FixtureComponent"
        showDiagnostics
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText("Development diagnostics")).toBeInTheDocument();
    expect(screen.getByText(/fixture diagnostics/)).toBeInTheDocument();
  });
});

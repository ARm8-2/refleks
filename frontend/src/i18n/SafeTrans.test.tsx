import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { initializeI18n } from ".";
import { SafeTrans } from "./SafeTrans";

beforeAll(async () => {
  await initializeI18n("en");
});

describe("SafeTrans", () => {
  it("renders only caller-provided React components", () => {
    render(
      <SafeTrans
        i18nKey="common:richText.documentation"
        values={{ topic: "Replay" }}
        components={{ docsLink: <a href="https://refleksapp.com/docs/" /> }}
      />,
    );

    expect(screen.getByRole("link", { name: "documentation" })).toHaveAttribute(
      "href",
      "https://refleksapp.com/docs/",
    );
  });

  it("renders interpolated markup as text instead of executable HTML", () => {
    render(
      <SafeTrans
        i18nKey="common:richText.documentation"
        values={{ topic: '<img src="x" onerror="alert(1)">' }}
        components={{ docsLink: <span /> }}
      />,
    );

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText(/<img src="x"/)).toBeInTheDocument();
  });
});

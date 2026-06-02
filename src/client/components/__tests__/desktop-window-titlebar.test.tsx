import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeState = vi.hoisted(() => ({
  isTauri: false,
  pathname: "/workspace/default/kanban",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => runtimeState.pathname,
  useRouter: () => ({
    push: runtimeState.push,
  }),
}));

vi.mock("@/client/utils/diagnostics", () => ({
  isTauriRuntime: () => runtimeState.isTauri,
  desktopAwareFetch: vi.fn(),
}));

import { DesktopWindowTitlebar } from "../desktop-window-titlebar";

describe("DesktopWindowTitlebar", () => {
  beforeEach(() => {
    runtimeState.isTauri = false;
    runtimeState.pathname = "/workspace/default/kanban";
    runtimeState.push.mockClear();
  });

  it("does not render in the regular web runtime", () => {
    render(<DesktopWindowTitlebar workspaceId="default" />);

    expect(screen.queryByTestId("desktop-window-titlebar")).toBeNull();
  });

  it("renders a flat desktop menu bar in Tauri runtime", async () => {
    runtimeState.isTauri = true;

    render(<DesktopWindowTitlebar workspaceId="default" />);

    expect(await screen.findByTestId("desktop-window-titlebar")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^File$/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Edit$/i })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^File$/i }));

    expect(screen.getByRole("menu")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: /Reload/i })).not.toBeNull();
  });

  it("routes custom window menu actions through Next navigation", async () => {
    runtimeState.isTauri = true;

    render(<DesktopWindowTitlebar workspaceId="default" />);

    fireEvent.click(await screen.findByRole("button", { name: /^Window$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Settings/i }));

    expect(runtimeState.push).toHaveBeenCalledWith("/settings?workspaceId=default");
  });
});

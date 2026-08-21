import { describe, it, expect, afterEach } from "vitest";
import * as tui from "./tui.js";
import { createTempDir, createGitRepo, createTempFile, git, cleanupDir } from "./helpers.js";

let dir;

afterEach(() => {
  tui.kill();
  if (dir) cleanupDir(dir);
});

// The commit log sits in a 7-row box pinned to the bottom of the changes panel,
// so its rows are at fixed screen positions for a given terminal height: at
// 120x40 the branch header is row 31 and the newest commit row 32.
const BRANCH_ROW = 31;
const FIRST_COMMIT_ROW = 32;

function repoWithTwoCommits() {
  const d = createGitRepo(createTempDir());
  createTempFile(d, "tracked.txt", "original\nsecond line\n");
  createTempFile(d, "added.txt", "brand new\n");
  git(d, "add", "-A");
  git(d, "commit", "-qm", "second commit");
  return d;
}

describe("commit history", () => {
  it("should list a commit's files when the commit is expanded", () => {
    dir = repoWithTwoCommits();

    tui.start(dir);
    tui.waitFor("Changes");
    tui.press("ctrl+k");
    tui.press("c");
    tui.waitStable(400);

    const collapsed = tui.snapshot();
    tui.click(5, FIRST_COMMIT_ROW);
    tui.waitStable(400);
    const expanded = tui.snapshot();

    const { snapshots } = tui.run();
    expect(snapshots[collapsed]).toContain("second commit");
    expect(snapshots[collapsed]).not.toContain("added.txt");
    expect(snapshots[expanded]).toContain("added.txt");
    expect(snapshots[expanded]).toContain("tracked.txt");
  });

  it("should open a diff for a file inside a commit", () => {
    dir = repoWithTwoCommits();

    tui.start(dir);
    tui.waitFor("Changes");
    tui.press("ctrl+k");
    tui.press("c");
    tui.waitStable(400);

    tui.click(5, FIRST_COMMIT_ROW);
    tui.waitStable(400);
    // First child of the expanded commit.
    tui.click(5, FIRST_COMMIT_ROW + 1);
    tui.waitStable(400);

    const s0 = tui.snapshot();
    const { snapshots } = tui.run();
    // The tab is labelled "<file> @ <hash>" so two commits touching the same
    // file do not collapse into one tab.
    expect(snapshots[s0]).toMatch(/added\.txt @ [0-9a-f]{7}/);
    expect(snapshots[s0]).toContain("brand new");
  });

  it("should route registered diff commands to the focused commit file", () => {
    dir = repoWithTwoCommits();

    tui.start(dir);
    tui.waitFor("Changes");
    tui.press("ctrl+k");
    tui.press("c");
    tui.waitStable(400);

    // Clicking the commit expands it and focuses the history tree. Move onto
    // its first child without activating it, then use the same registered
    // command surface exposed by ttt.exec_command and the debug harness.
    tui.click(5, FIRST_COMMIT_ROW);
    tui.waitStable(400);
    tui.press("down");
    tui.exec("Git: Open Compact Diff");
    tui.waitStable(400);

    const s0 = tui.snapshot();
    const { snapshots } = tui.run();
    expect(snapshots[s0]).toMatch(/added\.txt @ [0-9a-f]{7}/);
    expect(snapshots[s0]).toContain("brand new");
  });

  it("should keep the commit-file context through the command palette", () => {
    dir = repoWithTwoCommits();

    tui.start(dir);
    tui.waitFor("Changes");
    tui.pressChord("ctrl+k", "c");
    tui.waitStable(400);

    tui.click(5, FIRST_COMMIT_ROW);
    tui.waitStable(400);
    tui.press("down");
    tui.press("ctrl+p");
    tui.type("Git: Open Compact Diff");
    tui.press("enter");
    tui.waitStable(400);

    const s0 = tui.snapshot();
    const { snapshots } = tui.run();
    expect(snapshots[s0]).toMatch(/added\.txt @ [0-9a-f]{7}/);
    expect(snapshots[s0]).toContain("brand new");
  });

  it("should keep the branch header inert", () => {
    dir = repoWithTwoCommits();

    tui.start(dir);
    tui.waitFor("Changes");
    tui.press("ctrl+k");
    tui.press("c");
    tui.waitStable(400);

    tui.click(5, BRANCH_ROW);
    tui.waitStable(300);

    const s0 = tui.snapshot();
    const { snapshots } = tui.run();
    expect(snapshots[s0]).not.toContain("added.txt");
    expect(snapshots[s0]).not.toContain("(diff)");
  });
});

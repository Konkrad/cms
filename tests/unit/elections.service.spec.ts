import { describe, it, expect, afterEach } from "vitest";
import { electionsService } from "~/services/elections.service";
import {
  createTestUser,
  createTestMembership,
  createTestElectionCycle,
  createTestElectionPosition,
  createTestElectionApplication,
  openDb,
} from "./helpers";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
});

// ── Cycles ────────────────────────────────────────────────────────────────────

describe("electionsService.createCycle", () => {
  it("creates a cycle with status draft", async () => {
    const { cleanup, cycleId } = createTestElectionCycle();
    cleanups.push(cleanup);

    const cycle = await electionsService.getCycleById(cycleId);
    expect(cycle?.status).toBe("draft");
  });
});

describe("electionsService.updateCycle", () => {
  it("advances draft → open", async () => {
    const { cleanup, cycleId } = createTestElectionCycle({ status: "draft" });
    cleanups.push(cleanup);

    await electionsService.updateCycle(cycleId, { status: "open" });
    const cycle = await electionsService.getCycleById(cycleId);
    expect(cycle?.status).toBe("open");
  });

  it("advances open → closed", async () => {
    const { cleanup, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cleanup);

    await electionsService.updateCycle(cycleId, { status: "closed" });
    const cycle = await electionsService.getCycleById(cycleId);
    expect(cycle?.status).toBe("closed");
  });

  it("rejects closed → open with an error", async () => {
    const { cleanup, cycleId } = createTestElectionCycle({ status: "closed" });
    cleanups.push(cleanup);

    await expect(electionsService.updateCycle(cycleId, { status: "open" })).rejects.toThrow();
  });
});

// ── Positions ─────────────────────────────────────────────────────────────────

describe("electionsService.createPosition", () => {
  it("succeeds when cycle is draft", async () => {
    const { cleanup, cycleId } = createTestElectionCycle({ status: "draft" });
    cleanups.push(cleanup);

    const position = await electionsService.createPosition({ cycleId, title: "Treasurer" });
    expect(position.title).toBe("Treasurer");
  });
});

describe("electionsService.deletePosition", () => {
  it("succeeds when cycle is draft", async () => {
    const { cleanup, cycleId } = createTestElectionCycle({ status: "draft" });
    cleanups.push(cleanup);
    const { positionId } = createTestElectionPosition(cycleId);

    const result = await electionsService.deletePosition(positionId);
    expect(result.error).toBeUndefined();
  });

  it("returns an error when cycle is open", async () => {
    const { cleanup, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cleanup);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);

    const result = await electionsService.deletePosition(positionId);
    expect(result.error).toContain("draft");
  });
});

// ── Applications ──────────────────────────────────────────────────────────────

describe("electionsService.createApplication", () => {
  it("creates an application with status pending", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);

    const result = await electionsService.createApplication({
      positionId,
      cycleId,
      userId,
      motivationWhy: "I want to help",
      motivationExperience: "I have experience",
      motivationGoals: "Improve things",
    });

    expect(result.error).toBeUndefined();
    expect(result.application?.status).toBe("pending");
    expect(result.application?.userId).toBe(userId);
  });

  it("returns friendly error on duplicate (positionId, userId)", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);

    await electionsService.createApplication({
      positionId, cycleId, userId,
      motivationWhy: "Why", motivationExperience: "Exp", motivationGoals: "Goals",
    });
    const second = await electionsService.createApplication({
      positionId, cycleId, userId,
      motivationWhy: "Why", motivationExperience: "Exp", motivationGoals: "Goals",
    });

    expect(second.error).toMatch(/already applied/i);
  });

  it("returns error when user tier is below cycle requirement", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);

    // set requiredMembershipTier on the cycle
    const db = openDb();
    db.prepare("UPDATE election_cycles SET required_membership_tier = ? WHERE id = ?").run("full", cycleId);
    db.close();

    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);

    // user has no membership
    const result = await electionsService.createApplication({
      positionId, cycleId, userId,
      motivationWhy: "Why", motivationExperience: "Exp", motivationGoals: "Goals",
    });

    expect(result.error).toMatch(/full member/i);
  });

  it("succeeds when requiredMembershipTier is null", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);

    const result = await electionsService.createApplication({
      positionId, cycleId, userId,
      motivationWhy: "Why", motivationExperience: "Exp", motivationGoals: "Goals",
    });
    expect(result.error).toBeUndefined();
  });
});

describe("electionsService.updateApplicationStatus", () => {
  it("sets status to approved", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);
    const { appId, cleanup: ac } = createTestElectionApplication(positionId, cycleId, userId);
    cleanups.push(ac);

    const updated = await electionsService.updateApplicationStatus(appId, "approved");
    expect(updated.status).toBe("approved");
    expect(updated.adminNote).toBeNull();
  });

  it("sets status to rejected with admin note", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);
    const { appId, cleanup: ac } = createTestElectionApplication(positionId, cycleId, userId);
    cleanups.push(ac);

    const updated = await electionsService.updateApplicationStatus(appId, "rejected", "Insufficient experience");
    expect(updated.status).toBe("rejected");
    expect(updated.adminNote).toBe("Insufficient experience");
  });
});

describe("electionsService.getApprovedApplicationsByCycle", () => {
  it("returns only approved rows", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);
    const { appId: pendingId, cleanup: pa } = createTestElectionApplication(positionId, cycleId, userId, "pending");
    cleanups.push(pa);

    const { userId: userId2, cleanup: c2 } = createTestUser();
    cleanups.push(c2);
    const { appId: approvedId, cleanup: aa } = createTestElectionApplication(positionId, cycleId, userId2, "approved");
    cleanups.push(aa);

    const approved = await electionsService.getApprovedApplicationsByCycle(cycleId);
    const ids = approved.map((a) => a.id);
    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(pendingId);
  });

  it("never includes adminNote field", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);
    const { appId, cleanup: ac } = createTestElectionApplication(positionId, cycleId, userId, "approved");
    cleanups.push(ac);
    const db = openDb();
    db.prepare("UPDATE election_applications SET admin_note = ? WHERE id = ?").run("secret", appId);
    db.close();

    const approved = await electionsService.getApprovedApplicationsByCycle(cycleId);
    for (const app of approved) {
      expect("adminNote" in app).toBe(false);
    }
  });
});

describe("electionsService.getApplicationsByUser", () => {
  it("returns all statuses including adminNote", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { cleanup: cc, cycleId } = createTestElectionCycle({ status: "open" });
    cleanups.push(cc);
    const { positionId, cleanup: pc } = createTestElectionPosition(cycleId);
    cleanups.push(pc);
    const { appId, cleanup: ac } = createTestElectionApplication(positionId, cycleId, userId, "rejected");
    cleanups.push(ac);
    const db = openDb();
    db.prepare("UPDATE election_applications SET admin_note = ? WHERE id = ?").run("feedback note", appId);
    db.close();

    const apps = await electionsService.getApplicationsByUser(userId);
    const app = apps.find((a) => a.id === appId);
    expect(app?.adminNote).toBe("feedback note");
  });
});

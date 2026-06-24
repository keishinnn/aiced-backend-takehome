import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { asUser, asOwner, pool, ALICE, BOB, CAROL, ACME, GLOBEX } from "./helpers";

describe("notes", () => {
  // Seed committed notes so asUser queries can see them.
  beforeAll(async () => {
    await asOwner(
      `insert into notes (group_id, author_id, body) values
        ($1, $2, 'Acme note from Alice'),
        ($3, $4, 'Globex note from Bob')`,
      [ACME, ALICE, GLOBEX, BOB],
    );
  });

  afterAll(async () => {
    await asOwner("delete from notes");
    await pool.end();
  });

  // ---------- SELECT isolation ----------

  it("a member sees only their own group's notes", async () => {
    // Alice is in Acme only — she should see 1 note.
    const aliceNotes = await asUser(ALICE, async (q) =>
      (await q("select id, group_id, body from notes")).rows,
    );
    expect(aliceNotes).toHaveLength(1);
    expect(aliceNotes[0].group_id).toBe(ACME);

    // Bob is in Globex only — he should see 1 note.
    const bobNotes = await asUser(BOB, async (q) =>
      (await q("select id, group_id, body from notes")).rows,
    );
    expect(bobNotes).toHaveLength(1);
    expect(bobNotes[0].group_id).toBe(GLOBEX);
  });

  it("a user in multiple groups sees notes from all their groups", async () => {
    // Carol is in both Acme and Globex — she should see 2 notes.
    const carolNotes = await asUser(CAROL, async (q) =>
      (await q("select id, group_id, body from notes")).rows,
    );
    expect(carolNotes).toHaveLength(2);
    const groupIds = carolNotes.map((r: { group_id: string }) => r.group_id);
    expect(groupIds).toContain(ACME);
    expect(groupIds).toContain(GLOBEX);
  });

  // ---------- INSERT isolation ----------

  it("a user cannot insert a note into a group they don't belong to", async () => {
    // Alice is NOT in Globex — this insert should fail.
    await expect(
      asUser(ALICE, async (q) =>
        q(
          "insert into notes (group_id, author_id, body) values ($1, $2, 'should fail')",
          [GLOBEX, ALICE],
        ),
      ),
    ).rejects.toThrow();
  });

  it("a user can insert a note into their own group", async () => {
    // Alice IS in Acme — this insert should succeed (rolled back by asUser).
    const result = await asUser(ALICE, async (q) => {
      await q(
        "insert into notes (group_id, author_id, body) values ($1, $2, 'hello from test')",
        [ACME, ALICE],
      );
      return (await q("select body from notes where body = 'hello from test'")).rows;
    });
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe("hello from test");
  });
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRecipients,
  normalizePhone,
  isValidPhone,
  renderTemplate
} = require("./recipients");

const template = "Dear {{parentName}}, {{children}} owes Rs.{{totalDue}} to {{schoolName}}.";

test("normalizes Indian parent mobile numbers", () => {
  assert.equal(normalizePhone("98765 43210"), "919876543210");
  assert.equal(normalizePhone("09876543210"), "919876543210");
  assert.equal(normalizePhone("+91 98765 43210"), "919876543210");
  assert.equal(normalizePhone("123"), "");
  assert.equal(isValidPhone("919876543210"), true);
});

test("groups siblings under one parent phone and sums dues", () => {
  const built = buildRecipients(
    [
      {
        id: "s1",
        studentName: "Aarav",
        parentName: "Ravi",
        parentMobile: "9876543210",
        class: "10",
        section: "A",
        totalFeesDue: 1000
      },
      {
        id: "s2",
        studentName: "Ananya",
        parentName: "Ravi",
        parentMobile: "9876543210",
        class: "8",
        section: "B",
        totalFeesDue: 500
      }
    ],
    { template, schoolName: "Test School" }
  );

  assert.equal(built.recipients.length, 1);
  assert.equal(built.recipients[0].phone, "919876543210");
  assert.equal(built.recipients[0].studentCount, 2);
  assert.equal(built.recipients[0].dueAmount, 1500);
  assert.match(built.recipients[0].message, /Aarav/);
  assert.match(built.recipients[0].message, /Ananya/);
  assert.match(built.recipients[0].message, /1,500/);
});

test("skips invalid numbers and recently messaged phones", () => {
  const built = buildRecipients(
    [
      { id: "s1", studentName: "No Phone", parentMobile: "" },
      { id: "s2", studentName: "Recent", parentMobile: "9876543210" }
    ],
    { template, cooldownPhones: new Set(["919876543210"]) }
  );

  assert.equal(built.recipients.length, 0);
  assert.equal(built.skipped.length, 1);
  assert.equal(built.duplicates.length, 1);
});

test("renders known placeholders and removes unknown ones", () => {
  assert.equal(
    renderTemplate("Hi {{parentName}} {{unknown}}", { parentName: "Ravi" }),
    "Hi Ravi "
  );
});

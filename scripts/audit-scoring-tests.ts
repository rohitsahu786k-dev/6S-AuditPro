import assert from "node:assert/strict";
import { calculateDepartmentAuditScore } from "../lib/audit-scoring";

const departments = ["Department A", "Department B"];
const sourceDepartmentByAuditId = new Map([
  ["audit-a", "Department A"],
  ["audit-b", "Department B"]
]);
const sourceDepartmentByAuditNumber = new Map([
  ["A-001", "Department A"],
  ["B-001", "Department B"]
]);

function adequate(count: number, category = "1S") {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `${category}-adequate-${index}`,
    category,
    question: `${category} adequate ${index}`,
    response: "Adequate" as const
  }));
}

function notAdequate(count: number, department: string, category = "1S", prefix = "na") {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `${prefix}-${index}`,
    category,
    question: `${prefix} ${index}`,
    response: "Not Adequate" as const,
    actionOwnerDepartment: department
  }));
}

const basic = calculateDepartmentAuditScore({
  audit: {
    _id: "basic",
    auditNumber: "BASIC",
    department: "Department A",
    checklist: [
      ...adequate(8),
      ...notAdequate(2, "Department A"),
      ...Array.from({ length: 5 }, (_, index) => ({
        questionId: `na-excluded-${index}`,
        category: "1S",
        question: `N/A ${index}`,
        response: "N/A" as const
      }))
    ]
  },
  department: "Department A",
  configuredDepartments: departments
});
assert.equal(basic.adequateCount, 8);
assert.equal(basic.ownedNotAdequateCount, 2);
assert.equal(basic.applicableCount, 10);
assert.equal(basic.score, 80);

const transferAuditA = {
  _id: "audit-a",
  auditNumber: "A-001",
  department: "Department A",
  checklist: [
    ...adequate(20),
    ...notAdequate(5, "Department A", "2S", "a-owned")
  ]
};
const transferredFindingsFromA = [
  ...Array.from({ length: 3 }, (_, index) => ({
    _id: `a-own-${index}`,
    auditId: "audit-a",
    auditNumber: "A-001",
    department: "Department A",
    questionId: `a-owned-${index}`,
    category: "2S",
    question: `a-owned ${index}`
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    _id: `a-transfer-${index}`,
    auditId: "audit-a",
    auditNumber: "A-001",
    department: "Department B",
    questionId: `a-owned-${index + 3}`,
    category: "2S",
    question: `a-owned ${index + 3}`
  }))
];
const transferOut = calculateDepartmentAuditScore({
  audit: transferAuditA,
  department: "Department A",
  findings: transferredFindingsFromA,
  configuredDepartments: departments,
  sourceDepartmentByAuditId,
  sourceDepartmentByAuditNumber
});
assert.equal(transferOut.ownedNotAdequateCount, 3);
assert.equal(transferOut.score, 87);

const auditB = {
  _id: "audit-b",
  auditNumber: "B-001",
  department: "Department B",
  checklist: [
    ...adequate(10),
    ...notAdequate(1, "Department B", "2S", "b-owned")
  ]
};
const transferIn = calculateDepartmentAuditScore({
  audit: auditB,
  department: "Department B",
  findings: [
    {
      _id: "b-own-0",
      auditId: "audit-b",
      auditNumber: "B-001",
      department: "Department B",
      questionId: "b-owned-0",
      category: "2S",
      question: "b-owned 0"
    },
    ...transferredFindingsFromA
  ],
  configuredDepartments: departments,
  sourceDepartmentByAuditId,
  sourceDepartmentByAuditNumber
});
assert.equal(transferIn.ownedNotAdequateCount, 3);
assert.equal(transferIn.score, 77);

const beforeTransfer = calculateDepartmentAuditScore({
  audit: transferAuditA,
  department: "Department A",
  findings: [{ ...transferredFindingsFromA[3], department: "Department A" }],
  configuredDepartments: departments,
  sourceDepartmentByAuditId,
  sourceDepartmentByAuditNumber
});
const afterTransferA = calculateDepartmentAuditScore({
  audit: transferAuditA,
  department: "Department A",
  findings: [{ ...transferredFindingsFromA[3], department: "Department B" }],
  configuredDepartments: departments,
  sourceDepartmentByAuditId,
  sourceDepartmentByAuditNumber
});
const afterTransferB = calculateDepartmentAuditScore({
  audit: auditB,
  department: "Department B",
  findings: [{ ...transferredFindingsFromA[3], department: "Department B" }],
  configuredDepartments: departments,
  sourceDepartmentByAuditId,
  sourceDepartmentByAuditNumber
});
assert.equal(beforeTransfer.ownedNotAdequateCount, 5);
assert.equal(afterTransferA.ownedNotAdequateCount, 4);
assert.equal(afterTransferB.ownedNotAdequateCount, 2);

const unequalCategorySizes = calculateDepartmentAuditScore({
  audit: {
    _id: "unequal",
    auditNumber: "UNEQUAL",
    department: "Department A",
    checklist: [
      ...adequate(9, "1S"),
      ...notAdequate(1, "Department A", "1S", "c1"),
      ...adequate(1, "2S"),
      ...notAdequate(1, "Department A", "2S", "c2")
    ]
  },
  department: "Department A",
  configuredDepartments: departments
});
assert.equal(unequalCategorySizes.score, 83);

const monthlyScores = [87, 92, 78];
const monthlyAverage = Math.round(monthlyScores.reduce((sum, score) => sum + score, 0) / monthlyScores.length);
assert.equal(monthlyAverage, 86);

console.log("Canonical audit scoring checks passed.");

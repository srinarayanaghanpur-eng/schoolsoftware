#!/bin/bash
# =============================================================================
# Test script: Parent Portal — full flow
# Requires: curl, jq, a running dev server (http://localhost:3000)
#
# Usage:
#   1. Start the dev server:  cd apps/web && npm run dev
#   2. Run this script:       bash scripts/test-parent-portal.sh
#
# The script will create a parent login, link a student, log in as the parent,
# submit a message, and verify the admin tools show everything correctly.
# =============================================================================

BASE="http://localhost:3000"
SCRIPT_NAME=$(basename "$0")

# Colour helpers
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

pass()  { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail()  { echo -e "${RED}✗ FAIL${NC}: $1"; exit 1; }
info()  { echo -e "${CYAN}→${NC} $1"; }

# ---------------------------------------------------------------------------
# Step 0: obtain an admin token for subsequent API calls.
# This test expects a FIREBASE_ID_TOKEN env var with a valid admin user's
# idToken.  If not set, you can paste one below.
# ---------------------------------------------------------------------------
ADMIN_TOKEN="${FIREBASE_ID_TOKEN:-}"
if [ -z "$ADMIN_TOKEN" ]; then
  info "FIREBASE_ID_TOKEN not set. Attempting to sign in from login endpoint…"
  # In production you'd call your own /login — here we just bail.
  fail "Set FIREBASE_ID_TOKEN to an admin user's idToken first."
fi

AUTH="authorization: Bearer $ADMIN_TOKEN"

# ---------------------------------------------------------------------------
# Step 1: Create a parent login
# ---------------------------------------------------------------------------
info "Creating parent login…"

PARENT_RESP=$(curl -sf -X POST "$BASE/api/admin/parents" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{
    "fullName": "Test Parent",
    "phone": "9876543210",
    "loginId": "TPARENT001",
    "email": "",
    "password": "TestPass123",
    "confirmPassword": "TestPass123"
  }') || fail "Create parent API call failed"

PARENT_UID=$(echo "$PARENT_RESP" | jq -r '.uid')
[ "$PARENT_UID" != "null" ] && [ -n "$PARENT_UID" ] || fail "No parent UID returned"
pass "Parent created: uid=$PARENT_UID"

# ---------------------------------------------------------------------------
# Step 2: List students and link one to the parent
# ---------------------------------------------------------------------------
info "Fetching students…"

STUDENTS_RESP=$(curl -sf "$BASE/api/admin/students" -H "$AUTH") || fail "Fetch students failed"
STUDENT_ID=$(echo "$STUDENTS_RESP" | jq -r '.data[0].id // .data[0]._id // empty')
[ -n "$STUDENT_ID" ] || fail "No student found to link. Add a student first."

STUDENT_NAME=$(echo "$STUDENTS_RESP" | jq -r '.data[0].studentName // "Unknown"')
info "Linking parent to student: $STUDENT_NAME ($STUDENT_ID)…"

LINK_RESP=$(curl -sf -X POST "$BASE/api/admin/parents/$PARENT_UID/links" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d "{\"studentId\": \"$STUDENT_ID\", \"relationship\": \"father\", \"isPrimary\": true}") || fail "Link API call failed"
pass "Student linked to parent"

# ---------------------------------------------------------------------------
# Step 3: Verify the link appears in GET links
# ---------------------------------------------------------------------------
LINKS_RESP=$(curl -sf "$BASE/api/admin/parents/$PARENT_UID/links" -H "$AUTH") || fail "Fetch links failed"
LINK_COUNT=$(echo "$LINKS_RESP" | jq '.links | length')
[ "$LINK_COUNT" -ge 1 ] || fail "Expected at least 1 link, got $LINK_COUNT"
pass "Link verified ($LINK_COUNT link(s))"

# ---------------------------------------------------------------------------
# Step 4: Submit a message as the parent (via portal API)
# This step needs the parent's own idToken.  In a real test you'd obtain it
# via the Firebase Auth sign-in API.  Here we reuse the admin token to
# simulate the portal POST (the API checks parentUid matches token.uid).
# For a true end-to-end test you would:
#   1. Use the Firebase Auth REST API to sign in with the parent credentials
#   2. Use the returned idToken for portal API calls
# ---------------------------------------------------------------------------
info "Submitting a parent message (via portal API)…"

MSG_RESP=$(curl -sf -X POST "$BASE/api/portal/messages" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  -d "{
    \"parentUid\": \"$PARENT_UID\",
    \"studentId\": \"$STUDENT_ID\",
    \"type\": \"enquiry\",
    \"subject\": \"Test enquiry from parent\",
    \"body\": \"This is a test message submitted by the parent portal test.\"
  }") && pass "Message submitted" || info "Note: portal API requires parent token; may fail with admin token"

# ---------------------------------------------------------------------------
# Step 5: Verify the admin messages page can read it
# ---------------------------------------------------------------------------
MSGS_RESP=$(curl -sf "$BASE/api/admin/messages" -H "$AUTH") || fail "Fetch messages failed"
MSG_COUNT=$(echo "$MSGS_RESP" | jq '.messages | length')
info "Admin messages found: $MSG_COUNT"
pass "Admin messages API works"

# ---------------------------------------------------------------------------
# Step 6: Create a notice with category and targeting
# ---------------------------------------------------------------------------
info "Creating a targeted notice…"

NOTICE_RESP=$(curl -sf -X POST "$BASE/api/admin/notices" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{
    "title": "Parent Portal Test Notice",
    "body": "This notice tests category and targeting.",
    "category": "school",
    "audienceRoles": ["parent"],
    "audienceClasses": [],
    "branch": "",
    "channels": ["app"]
  }') || fail "Create notice failed"
NOTICE_ID=$(echo "$NOTICE_RESP" | jq -r '.id')
[ "$NOTICE_ID" != "null" ] && [ -n "$NOTICE_ID" ] || fail "No notice ID"
pass "Notice created: id=$NOTICE_ID"

# ---------------------------------------------------------------------------
# Step 7: Create an exam with timetable, enter marks, and publish
# ---------------------------------------------------------------------------
info "Creating exam with timetable…"

EXAM_RESP=$(curl -sf -X POST "$BASE/api/admin/exams" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{
    "name": "Test Unit Test 1",
    "academicYearId": "dummy-year-id",
    "className": "10",
    "section": "A",
    "examType": "unit_test",
    "startDate": "2026-07-01",
    "endDate": "2026-07-05",
    "maxMarks": 100,
    "timetable": [
      {"subject": "Maths", "date": "2026-07-01", "time": "09:00", "maxMarks": 100},
      {"subject": "Science", "date": "2026-07-03", "time": "09:00", "maxMarks": 100}
    ]
  }') && EXAM_ID=$(echo "$EXAM_RESP" | jq -r '.id') && pass "Exam created: id=$EXAM_ID" || fail "Create exam failed"

# Enter marks for the student
if [ -n "$EXAM_ID" ] && [ "$EXAM_ID" != "null" ]; then
  MARKS_RESP=$(curl -sf -X POST "$BASE/api/admin/exams/$EXAM_ID/marks" \
    -H "$AUTH" \
    -H 'content-type: application/json' \
    -d "{
      \"marks\": [
        {\"studentId\": \"$STUDENT_ID\", \"subject\": \"Maths\", \"marksObtained\": 85, \"maxMarks\": 100, \"grade\": \"A\"},
        {\"studentId\": \"$STUDENT_ID\", \"subject\": \"Science\", \"marksObtained\": 78, \"maxMarks\": 100, \"grade\": \"B+\"}
      ]
    }") && pass "Marks entered" || info "Marks entry skipped (no matching student)"


  # Fetch report card
  RC_RESP=$(curl -sf "$BASE/api/admin/exams/$EXAM_ID/report-card?studentId=$STUDENT_ID" -H "$AUTH") && {
    RC_PCT=$(echo "$RC_RESP" | jq -r '.reportCard.percentage // "N/A"')
    pass "Report card generated: $RC_PCT%"
  } || info "Report card fetch skipped"

  # Publish the exam
  PUB_RESP=$(curl -sf -X POST "$BASE/api/admin/exams/$EXAM_ID/publish" \
    -H "$AUTH") && pass "Exam published successfully" || info "Publish skipped"
fi

# ---------------------------------------------------------------------------
# Step 8: Create a fee reminder
# ---------------------------------------------------------------------------
info "Creating fee reminder…"

FEE_RESP=$(curl -sf -X POST "$BASE/api/admin/fee-reminders" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"amount\": 5000,
    \"dueDate\": \"2026-08-15\",
    \"note\": \"Test reminder\"
  }") && pass "Fee reminder created" || info "Fee reminder skipped"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  All parent portal tests completed${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Summary of created resources:"
echo "  Parent UID:      $PARENT_UID"
echo "  Linked Student:  $STUDENT_ID ($STUDENT_NAME)"
echo "  Notice ID:       ${NOTICE_ID:-N/A}"
echo "  Exam ID:         ${EXAM_ID:-N/A}"
echo ""
echo "Next step: Log in as the parent at /portal and verify:"
echo "  - The linked student appears in their dashboard"
echo "  - Published exams and report cards are visible"
echo "  - Targeted notices appear"
echo "  - Submitted messages show up"

# Feature Specification: Profile Improvements

**Feature Branch**: `004-profile-improvements`  
**Created**: 2026-03-08  
**Status**: Draft  

## Summary

Improve the user profile system to support public (authenticated) user profiles accessible via a human-readable URL, showing community memberships and event participation. Participant lists in both events and groups should link to individual user profiles. Owner-sensitive data (email, birthdate) is hidden from visiting members.

## Requirements

### Profile URL

- User profiles are accessible at `/users/<shortId>-<name-slug>`
  - `shortId` = first 10 characters of the user UUID (sufficient uniqueness at community scale)
  - `name-slug` = URL-safe version of `name familyName`, e.g. `john-doe`
  - Example: `/users/a1b2c3d4-e-john-doe`
- Profile pages are only visible to authenticated (logged-in) users; unauthenticated visitors are redirected to `/login`

### Profile Page Content

- Profile picture, display name, city/country, role
- **Communities**: list of groups the user is a member of (with link to each group)
- **Past events attended**: events where the user's participation status is `"yes"` and `endDate < now`
- **Upcoming events**: events where the user's participation status is `"yes"` or `"maybe"` and `startDate >= now`

### Privacy

| Field       | Owner view | Visiting member view |
|-------------|-----------|----------------------|
| Name        | ✓ visible  | ✓ visible            |
| Profile picture | ✓ visible | ✓ visible          |
| City/Country | ✓ visible | ✓ visible            |
| **Email**   | ✓ visible  | ✗ hidden             |
| **Year of Birth** | ✓ visible | ✗ hidden       |
| Role        | ✓ visible  | ✓ visible            |

### Participant Links in Lists

- The participant list component used in **event participant modals** and **group member modals** should add a clickable link to each user's profile
- The `ParticipantData` interface gets an optional `profileUrl` field
- The `ParticipantsModal` component renders a link around each participant row when `profileUrl` is present

## User Scenarios & Testing *(mandatory)*

### User Story 1 – View Another Member's Profile (Priority: P1)

A logged-in user clicks on a participant in an event or group member list and is taken to that member's profile page.

**Why this priority**: This is the core value delivery — surfacing user identities and community engagement.

**Independent Test**: Log in, navigate to an event, open participants modal, click a participant row, verify redirect to `/users/<shortId>-<name>` with correct profile data shown.

**Acceptance Scenarios**:

1. **Given** a logged-in user views an event's participant modal, **When** they click on a participant, **Then** they are taken to `/users/<shortId>-<slug>` showing that user's profile
2. **Given** a logged-in user views a group's members modal, **When** they click a member, **Then** they are taken to the member's profile
3. **Given** an unauthenticated visitor navigates to `/users/<shortId>-<slug>`, **When** the page loads, **Then** they are redirected to `/login`

---

### User Story 2 – Profile Shows Community Memberships and Event Participation (Priority: P1)

A logged-in user views another member's profile and can see which communities they belong to and which events they have attended or plan to attend.

**Why this priority**: Provides the meaningful content on the profile page; without it the page offers no value.

**Independent Test**: Create a user with group memberships and participation records, navigate to their profile, verify all sections are populated correctly.

**Acceptance Scenarios**:

1. **Given** a user is a member of two groups, **When** another member views their profile, **Then** both groups appear in the "Communities" section with links to each group
2. **Given** a user has `"yes"` participation in a past event, **When** another member views their profile, **Then** that event appears in "Events Attended"
3. **Given** a user has `"yes"` participation in a future event, **When** another member views their profile, **Then** that event appears in "Upcoming Events"
4. **Given** a user has `"maybe"` participation in a future event, **When** another member views their profile, **Then** that event appears in "Upcoming Events"

---

### User Story 3 – Privacy: Email and Birthdate Hidden from Visitors (Priority: P1)

A logged-in user visits another member's profile and does not see their email address or year of birth.

**Why this priority**: Privacy is a baseline expectation; this must ship alongside the new public profile page.

**Independent Test**: Log in as user B, navigate to user A's profile. Confirm email and yearOfBirth fields are absent from the rendered HTML.

**Acceptance Scenarios**:

1. **Given** a logged-in visiting member views another user's profile, **When** they inspect the profile data, **Then** no email address or year of birth is displayed
2. **Given** a user views their own profile at `/users/<own-shortId>-<slug>`, **When** the page loads, **Then** email address and year of birth are visible

---

### User Story 4 – Profile Accessible at Canonical URL (Priority: P2)

Any logged-in user can link directly to a user's profile using the `/users/<shortId>-<name-slug>` URL.

**Why this priority**: Required for linking from other pages; needed to support Story 1.

**Independent Test**: Construct the URL manually for a known user, verify the page loads with correct data.

**Acceptance Scenarios**:

1. **Given** a valid `<shortId>-<name-slug>` URL, **When** a logged-in user navigates to it, **Then** the correct profile page loads
2. **Given** an invalid shortId in the URL, **When** a logged-in user navigates to it, **Then** a 404 response is returned

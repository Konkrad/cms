# Feature Specification: Event Participation Tracking & Enhanced Features

**Feature Branch**: `002-event-participation-tracking`  
**Created**: 2025-12-26  
**Status**: Draft  
**Input**: User description: "I want to enhance the events system with the following features: 1. Participation Tracking, 2. Sales Period, 3. Private Event Photos, 4. Free Tickets, 5. Ticket Scanning for Attendance Verification"

## Clarifications

### Session 2025-12-29

- Q: What is the offline behavior for ticket scanning? → A: Tickets are scanned online, it fails if offline, it is not possible to rescan an already scanned ticket. Already implemented correctly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ticket Scanning for Attendance Verification (Priority: P1)

An event organizer hosts a paid event with 100 registered ticket holders. On the day of the event, the organizer uses a mobile device to scan attendee tickets at the entrance. Each successful scan marks the attendee as "attended" in the system. After the event, the organizer can view a list of who actually attended versus who purchased tickets but didn't show up.

**Why this priority**: This is the foundation for all other features. Attendance verification is required to determine who gets access to private photos and provides critical data for participation tracking. Without this, none of the other features can function properly.

**Independent Test**: Can be fully tested by creating an event, issuing tickets, scanning QR codes at mock entry points, and verifying attendance status updates in the system. Delivers immediate value by providing accurate attendance records.

**Acceptance Scenarios**:

1. **Given** an event organizer with a valid ticket QR code, **When** they scan the ticket, **Then** the system marks that ticket holder as "attended" and displays confirmation
2. **Given** a ticket that has already been scanned, **When** the organizer attempts to scan it again, **Then** the system indicates the ticket was already scanned and shows the first scan timestamp
3. **Given** an invalid or expired ticket QR code, **When** the organizer scans it, **Then** the system rejects the scan and displays an appropriate error message
4. **Given** an event with multiple ticket holders, **When** the organizer views attendance data, **Then** the system shows who attended versus who didn't, with scan timestamps

---

### User Story 2 - Free Tickets (Priority: P2)

An event organizer creates a completely free community event and wants to track attendance. They configure the event to issue free tickets during registration. Attendees register without payment, receive a ticket with QR code, and can be scanned at the event entrance just like paid tickets. For paid events, the organizer can also issue complimentary tickets to sponsors or VIPs without requiring payment.

**Why this priority**: Enables events to be free while maintaining attendance tracking capabilities. This is common for community events, meetups, and promotional events. It also allows flexibility for paid events to comp tickets.

**Independent Test**: Can be fully tested by creating a free event, registering attendees without payment, issuing tickets, and scanning them. Also test issuing complimentary tickets for paid events. Delivers value by enabling free event management.

**Acceptance Scenarios**:

1. **Given** an event configured as free, **When** a user registers, **Then** the system issues a ticket without requiring payment
2. **Given** a paid event, **When** an organizer issues a complimentary ticket to a specific user, **Then** the system creates a ticket marked as free for that user
3. **Given** a free ticket, **When** it is scanned at the event, **Then** it functions identically to a paid ticket for attendance verification
4. **Given** an event with both paid and free tickets, **When** viewing attendance reports, **Then** the system clearly indicates which tickets were paid versus free

---

### User Story 3 - Product Participant Capacity (Priority: P2)

An event organizer creates a hotel room product that can accommodate 2 people but is sold as a single unit. They configure the product with a participant capacity of 2. When a customer purchases this product, even though only one person is buying, the checkout process prompts them to provide details for both participants (e.g., names, emails, dietary requirements). The system validates that all participant information is complete before allowing the purchase. Staff can later view all participant details when scanning tickets or reviewing attendance.

**Why this priority**: Essential for products where multiple people share a single purchase unit (hotel rooms, group packages, meal plans). Ensures organizers have complete participant information for catering, accommodation, and logistics planning.

**Independent Test**: Can be fully tested by creating a product with participant capacity > 1, purchasing it through the checkout flow while providing multiple participant details, and verifying all participant data is captured and accessible. Delivers value by enabling proper data collection for shared-capacity products.

**Acceptance Scenarios**:

1. **Given** an admin creates a product, **When** they set participant capacity to a value greater than 1, **Then** the system saves the capacity configuration
2. **Given** a customer selects a product with participant capacity of 2, **When** they proceed to checkout, **Then** they are prompted to provide details for 2 participants
3. **Given** a customer is entering participant details, **When** they attempt to checkout with incomplete information, **Then** the system prevents checkout and displays validation errors
4. **Given** a product has participant capacity of 1, **When** a customer purchases it, **Then** no additional participant details are requested beyond the buyer information
5. **Given** staff view ticket details, **When** they access a ticket from a multi-capacity product, **Then** they can see all associated participant information

---

### User Story 4 - Sales Period Configuration (Priority: P3)

An event organizer is planning a conference 6 months in advance. They want to open ticket sales 4 months before the event (for early-bird pricing) and close sales 1 week before the event date. They configure the sales start date to 4 months before and sales end date to 1 week before. During this window, tickets are available for purchase. Outside this window, the purchase option is disabled but event information remains visible.

**Why this priority**: Essential for managing ticket sales windows, early-bird pricing periods, and registration deadlines. Prevents last-minute registrations when event planning requires finalized attendance counts.

**Independent Test**: Can be fully tested by creating an event with defined sales periods, attempting purchases before/during/after the sales window, and verifying appropriate access controls. Delivers value by providing sales window control.

**Acceptance Scenarios**:

1. **Given** an event with a future sales start date, **When** a user views the event, **Then** they see event details but cannot purchase tickets, with a message indicating when sales open
2. **Given** an event within its sales period, **When** a user attempts to purchase, **Then** the system allows ticket purchase
3. **Given** an event past its sales end date, **When** a user views the event, **Then** they see event details but cannot purchase tickets, with a message indicating sales have closed
4. **Given** an organizer configuring sales dates, **When** they set a sales end date after the event end date, **Then** the system rejects the configuration with a validation error

---

### User Story 5 - Participation Status Tracking (Priority: P4)

Users can view an event on the website and indicate their participation intent. For paid events, the "Yes" status is coupled with a ticket purchase (the UI may label the "Yes" action as "Buy Ticket"), while for free events, "Yes" acts as a standard RSVP. Users who are interested but have not yet purchased a ticket can select "Maybe" to signal intent. This ensures that a "Yes" always represents a confirmed attendee, while "Maybe" represents the potential audience.

**Why this priority**: Provides a clear distinction between confirmed attendees ("Yes") and leads ("Maybe"). This helps organizers distinguish between guaranteed headcount for logistics and potential interest for marketing follow-ups.

**Independent Test**: Can be fully tested by creating both a free and a paid event. For the free event, selecting "Yes" should register immediately. For the paid event, "Yes" should only be recorded upon successful checkout, while "Maybe" can be selected without payment. Organizers can then verify the accuracy of the participation summary.

**Acceptance Scenarios**:

1. **Given** a user viewing a **paid** event, **When** they attempt to select "Yes," **Then** the UI initiates the "Buy Ticket" flow and only records a "Yes" status once the transaction is complete.
2. **Given** a user viewing a **paid** event, **When** they are interested but have not purchased a ticket, **Then** they can select "Maybe" to record their intent in the system.
3. **Given** a user viewing a **free** event, **When** they select "Yes," **Then** the system records their status immediately as a confirmed participant.
4. **Given** a user who previously responded "Maybe," **When** they later complete a ticket purchase, **Then** the system updates their participation status from "Maybe" to "Yes."
5. **Given** an event organizer, **When** they view participation data, **Then** they see "Yes" as the count of confirmed/ticketed attendees and "Maybe/No" as the count of unconfirmed or declining leads.

---

### User Story 6 - Private Event Photos (Priority: P5)

After an event concludes, the organizer uploads 100 photos to a private storage area. These photos are only accessible to attendees who actually attended the event (verified through ticket scanning). When an attendee who was scanned at the event logs in and views the past event, they see a private photo gallery with thumbnail images. When they click a photo, the system generates a time-limited secure URL to view the full-resolution image. Users who purchased tickets but didn't attend cannot see these photos.

**Why this priority**: Adds post-event value for attendees and creates a private shared memory space. This is a nice-to-have feature that enhances the event experience but isn't critical for core event operations.

**Independent Test**: Can be fully tested by completing an event, uploading photos, verifying that only scanned attendees can access photos via secure URLs, and confirming non-attendees are denied access. Delivers value by creating exclusive post-event content.

**Acceptance Scenarios**:

1. **Given** an event has concluded and an organizer uploads photos, **When** the upload completes, **Then** photos are stored in a private location requiring secure access
2. **Given** a user who attended the event (scanned ticket), **When** they view the past event, **Then** they can see the private photo gallery
3. **Given** a user who purchased a ticket but didn't attend, **When** they view the past event, **Then** they cannot see the private photo gallery
4. **Given** an attendee viewing a photo, **When** they request to view full resolution, **Then** the system generates a time-limited secure URL valid for 1 hour
5. **Given** an expired secure URL, **When** someone attempts to access it, **Then** access is denied and a new URL must be generated

---

### Edge Cases

- What happens when a ticket is scanned multiple times by different devices simultaneously?
- How does the system handle sales period changes after tickets have already been sold?
- What happens if an organizer uploads private photos before the event has concluded?
- How does the system handle very large photo uploads (e.g., 500+ high-resolution photos)?
- What happens when a user's participation status is "yes" but they receive a free ticket and never attend?
- How does the system handle timezone differences for sales period start/end times across global events?
- What happens if an attendee loses access to their account after attending but wants to view private photos?
- How does the system handle expired secure photo URLs being shared or bookmarked?
- What happens when a customer purchases a product with participant capacity but provides incomplete participant details? (System should validate all required participant fields before allowing checkout)
- What happens when a product has participant capacity of 1? (System should not prompt for additional participant details beyond the buyer)
- What happens when admin changes participant capacity after tickets are already sold? (Existing tickets retain their original participant data, new purchases use updated capacity)
- How does the system handle participant data for free tickets with capacity requirements?

## Requirements *(mandatory)*

### Functional Requirements

#### Ticket Scanning & Attendance

- **FR-001**: System MUST allow event organizers to scan ticket QR codes to verify attendance
- **FR-002**: System MUST mark a ticket as "attended" with timestamp when successfully scanned
- **FR-003**: System MUST prevent duplicate scans by rejecting rescanning attempts on already-scanned tickets and displaying previous scan information
- **FR-004**: System MUST validate ticket authenticity and event association before marking attendance
- **FR-005**: System MUST provide real-time feedback (success/error) during ticket scanning
- **FR-005a**: System MUST require active internet connection for ticket scanning; offline scans MUST fail with clear error message

#### Free Tickets

- **FR-006**: System MUST allow events to be configured as completely free (no payment required)
- **FR-007**: System MUST allow organizers to issue complimentary tickets for paid events to specific users
- **FR-008**: System MUST generate scannable QR codes for free tickets identical in format to paid tickets
- **FR-009**: System MUST clearly distinguish free tickets from paid tickets in reporting and administration
- **FR-010**: System MUST process free ticket attendance scanning identically to paid tickets

#### Product Participant Capacity

- **FR-011**: System MUST allow admins to configure participant capacity for products (number of participants per product unit)
- **FR-012**: System MUST default participant capacity to 1 if not specified
- **FR-013**: System MUST prompt customers to provide participant details for all capacity slots when participant capacity > 1
- **FR-014**: System MUST collect participant information (name, email, phone, etc.) for each capacity slot
- **FR-015**: System MUST validate that all required participant details are provided before allowing checkout
- **FR-016**: System MUST associate participant information with each ticket generated from the product
- **FR-017**: System MUST display participant details in ticket views and admin interfaces
- **FR-018**: System MUST not prompt for additional participant details when capacity equals 1

#### Sales Period

- **FR-019**: System MUST allow organizers to define a sales start date/time for ticket availability
- **FR-020**: System MUST allow organizers to define a sales end date/time for ticket availability
- **FR-021**: System MUST validate that sales start date is before sales end date
- **FR-022**: System MUST validate that sales period is within the event's start and end dates
- **FR-023**: System MUST prevent ticket purchases outside the defined sales period
- **FR-024**: System MUST display appropriate messaging when sales haven't started or have ended

#### Participation Tracking

- **FR-025**: System MUST allow users to indicate participation intent (yes/no/maybe) for events
- **FR-026**: System MUST track participation status independently from ticket purchases
- **FR-027**: System MUST allow users to change their participation status at any time before the event
- **FR-028**: System MUST provide organizers with participation summaries (count of yes/no/maybe responses)
- **FR-029**: System MUST distinguish between participation intent and actual attendance (verified by ticket scan)

#### Private Event Photos

- **FR-030**: System MUST allow organizers to upload photos after an event concludes
- **FR-031**: System MUST store uploaded photos in a private storage location requiring authentication
- **FR-032**: System MUST restrict photo viewing to users who attended the event (verified attendance status)
- **FR-033**: System MUST generate time-limited secure URLs for photo access
- **FR-034**: System MUST set secure URL expiration to 1 hour with cache headers allowing URL reuse on page reload
- **FR-035**: System MUST prevent photo access for ticket holders who did not attend
- **FR-036**: System MUST support multiple photo formats (JPEG, PNG, HEIC, etc.)

### Key Entities

- **Event**: Represents a scheduled event with start date, end date, sales period (start/end), privacy settings, and ticket configuration (free/paid)
- **Ticket**: Represents a ticket issued to a user, includes QR code data, ticket type (free/paid), attendance status (attended/not attended), scan timestamp if attended, and associated participant details
- **Product**: Extended from ticket sales system to include participantCapacity (integer, default 1) specifying how many participant details are required per product unit
- **Participant**: Represents details of a person associated with a ticket/product. Contains name (string), email (string), phone (string), and any additional fields configured for the product. Each product unit can have multiple participants based on participantCapacity setting
- **Participation Status**: Represents a user's intent to participate, includes status (yes/no/maybe), timestamp of last update, and relationship to user and event
- **Event Photo**: Represents a photo uploaded by an organizer, includes storage reference, upload timestamp, and association with an event
- **Photo Access URL**: Represents a time-limited secure URL for viewing a specific photo, includes expiration timestamp and generation timestamp

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Event organizers can scan 100 tickets in under 5 minutes with clear visual/audio feedback per scan
- **SC-002**: Users can register for free events in under 1 minute from landing page to ticket confirmation
- **SC-003**: Customers can complete participant detail entry for multi-capacity products in under 2 minutes per product
- **SC-004**: System validates 100% of participant detail requirements before allowing checkout
- **SC-005**: Sales period configuration prevents 100% of out-of-window purchases automatically
- **SC-006**: Private photos are accessible only to verified attendees with 100% accuracy (no false positives allowing non-attendees)
- **SC-007**: Secure photo URLs expire correctly within the defined time window with zero access after expiration
- **SC-008**: Participation status tracking provides organizers with planning data at least 48 hours before event start
- **SC-009**: Ticket scanning requires real-time internet connection for validation; offline scanning is not supported and results in failure
- **SC-010**: Attendance reports show accurate differentiation between ticket holders, actual attendees, and participation responses with 100% accuracy
- **SC-011**: Participant information is correctly associated with tickets with 100% accuracy across all capacity configurations

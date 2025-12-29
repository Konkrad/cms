# Admin Guide: Ticket Scanning Workflow

## Overview
This guide explains how event organizers can scan tickets at event entrances to verify attendance and track participation.

## Accessing the Ticket Scanner

1. Navigate to **Admin Panel** → **Events**
2. Select the event you want to manage
3. Click on **"Scan Tickets"** in the event management menu

## Using the QR Code Scanner

### Starting a Scan Session
1. Allow camera access when prompted by your browser
2. The scanner will activate and display a live camera feed
3. Position the attendee's QR code within the camera frame

### Scanning Tickets
- **Valid Ticket**: Green checkmark appears, ticket is marked as attended with timestamp
- **Already Scanned**: Yellow warning shows previous scan time
- **Invalid QR Code**: Red error message explains the issue

### Keyboard Shortcuts
- `Spacebar`: Take a manual scan if auto-detect is slow
- `Esc`: Close the scanner modal

## Viewing Attendance Reports

### Real-time Attendance Stats
Navigate to **Events** → **[Your Event]** → **Attendance** to view:
- Total tickets issued (free + paid)
- Number of tickets scanned
- Attendance rate percentage
- List of attended vs. not attended

### Exporting Attendance Data
From the attendance page:
1. Click **"Export CSV"**
2. Opens spreadsheet with:
   - Attendee name
   - Email
   - Ticket type
   - Scan timestamp
   - Product purchased

## Managing Free Tickets

### Creating Free Events
1. Set product price to **€0.00**
2. System automatically marks tickets as free
3. No payment processing required
4. Tickets issued immediately upon registration

### Issuing Complimentary Tickets
For paid events, admins can issue comp tickets:
1. Go to **Events** → **[Event]** → **Comp Tickets**
2. Enter attendee email
3. Select product
4. Click **"Issue Free Ticket"**
5. Attendee receives ticket via email with QR code

## Sales Period Configuration

### Setting Sales Windows
When creating/editing events:
1. **Sales Start Date**: When tickets become available
2. **Sales End Date**: When sales close (must be ≤ event end date)
3. Leave empty for no restrictions

### Sales States
- **Pre-Sale**: Event visible, purchase button disabled with "Sales open on [date]"
- **Active**: Purchase button enabled
- **Closed**: Purchase disabled with "Sales have closed"

## Troubleshooting

### QR Code Won't Scan
- Ensure sufficient lighting
- Ask attendee to increase screen brightness
- Try manual entry: enter ticket UUID from confirmation email

### Wrong Camera Selected
- Click camera selector in scanner interface
- Choose correct device (usually back camera on mobile)

### Attendance Numbers Don't Match
- Check for duplicate tickets (system prevents this)
- Verify free tickets are counted correctly
- Export CSV for detailed audit

## Best Practices

1. **Test scanning before event**: Create test tickets and practice
2. **Have backup device**: Phone + tablet for redundancy
3. **Check-in station setup**: Good lighting, stable internet
4. **Multiple scanners**: For large events, use parallel check-in lanes
5. **Monitor real-time stats**: Track attendance rate during event

## Mobile Scanning

The scanner works on mobile devices:
- Use Safari (iOS) or Chrome (Android)
- Portrait orientation recommended
- Tap to focus on QR code if needed
- Works offline after initial page load

## Support

For technical issues:
- Check browser console for error messages
- Verify HTTPS connection (required for camera access)
- Contact system administrator if persistent issues

# Conference tools

Ingest conference form mail that automailer has already processed, and keep it as the register of who signed up.

## Language

**Submission**:
A Squarespace conference form email, identified by its Message-ID. One message is one signup. The same Message-ID is never stored twice; IMAP folder moves are not part of ingest.
_Avoid_: mail, registration, inbox item, IMAP UID (folder-local, changes if mail is moved)

**Attendee**:
The person named on a submission. Future exports and dietary lists are about attendees, not raw mail.
_Avoid_: participant, guest, registrant

**Processed mailbox**:
The IMAP folder automailer moves a submission to after it sends the confirmation letter. This project reads that folder; it does not move mail.
_Avoid_: inbox (unprocessed mail that automailer still owns)

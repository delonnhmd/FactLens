# PHASE 3 STEP 7

Supabase Storage setup for claim screenshots:

1. Create a Storage bucket named `claim-images`.
2. Set the bucket to public for V1.
3. Later, change the bucket to private if claim media needs stricter access control.

Suggested V1 Storage policies:

- Allow public read access to objects in `claim-images`.
- Allow authenticated users to upload images to their own folder path: `{auth.uid()}/{timestamp}.jpg`.
- Allow authenticated users to update/delete only objects in their own folder if edit/delete media is added later.

This step only stores image/screenshot uploads. Video upload and real image moderation are not enabled yet.

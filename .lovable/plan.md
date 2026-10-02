# Fix disappearing social thumbnails

## What's going wrong
Instagram (and Facebook, Threads, TikTok, X) don't give out permanent image links. The cover image address they hand out has a hidden expiry stamp built in, usually a few days. We currently save that address as-is. Once it expires, Instagram's servers refuse it and the thumbnail goes blank. Normal websites give permanent image links, so they keep working. Re-adding a link works because it fetches a fresh address, which will expire too.

So this isn't a cache problem. The saved image address simply stops working.

## The fix
1. **Keep our own copy of the image.** When a social link is saved, the server downloads the cover image right away and stores it in the app's cloud storage. The bookmark points to that permanent copy, so it never expires.
2. **Repair old bookmarks on their own.** If a thumbnail fails to load (like your existing Instagram saves), the app quietly fetches it again, stores a permanent copy, and updates the bookmark. Broken thumbnails come back the next time you see them, with nothing for you to do.
3. **Fallback.** If a fresh copy can't be fetched, show the folder icon instead of an empty box.

## Technical details
- New public storage bucket `thumbnails` (public read; writes only from the server).
- `link-metadata.functions.ts`: after resolving `image`, fetch its bytes and upload them to `thumbnails/<sha256(url)>.<ext>` with the admin client inside the handler. Return the public URL, falling back to the original if the upload fails. Apply this to every image, or at least to known expiring hosts (cdninstagram, fbcdn, twimg, tiktokcdn).
- New server fn `refreshThumbnail({ url })`, which reuses the same pipeline.
- `LinkTile`, `BookmarkCard` and `bookmark.$id`: on `<img onError>`, call refresh once per bookmark per session, then `update(id, { image })`. If refresh fails, render the icon placeholder.

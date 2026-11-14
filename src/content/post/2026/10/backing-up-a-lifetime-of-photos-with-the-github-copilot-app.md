---
title: "Backing up a Lifetime of Photos with the GitHub Copilot App"
date: 2026-10-05T12:00:00.000Z
images: ["/images/post/2026/10/lifetime-photo-backup-hero.webp"]
author: "Martin Woodward"
description: "190 Google Takeout parts, a Mac with no free space and an ExFAT SSD. The Chrome DevTools trick, the hashing and the macOS date hacks that got my photos home."
categories: ["personal", "technology", "ai", "github"]
tags: ["github-copilot", "google-photos", "backup", "python", "macos", "playwright"]
type: "regular"
---

I have a legacy plan with Google Workspace for my personal domain back when they were free. However, it does come with some storage limits - but super generous so I've been running this setup for decades with no issues.

But lately, I've been running low on Google Photos storage, and that made me ask a more awkward question: where was my copy of all those originals? I wanted something I could hold in my hand and read without signing into anything, so I bought an [external SSD](https://link.amazon/B07kuibwP), formatted it as ExFAT so it works on both my Mac and Windows machines, and sat down with the [GitHub Copilot App](https://github.com/features/copilot) to get roughly 379 GB of photos onto it.

Google Takeout gave me 190 download links, each one a ZIP of about 2.15 GB. My Mac had nowhere near enough free space for even a handful of them.

What followed took four days, two Python scripts, a chunk of JavaScript running inside a browser, and quite a lot of me typing my Google password. Here's what we built and the bits I'd steal if you're doing the same thing.

## The shape of it

![Architecture diagram. Inside the MacBook, the Copilot App drives a signed-in Chromium via Playwright MCP. A CDP session redirects downloads to a staging folder on the SSD, and Playwright's own download listener is removed so no second copy lands on the internal disk. The browser polls a Python stdlib HTTP worker on 127.0.0.1 for permission to download, gated on free space and a 15-second pause. An extraction thread in the same worker writes media, receipts and progress state to the ExFAT SSD.](/images/post/2026/10/photo-backup-architecture.webp)

There are two moving parts:

- **`takeout_browser.js`** runs inside a Chromium window I'd signed into myself, driven by Copilot through the [Playwright MCP server](https://github.com/microsoft/playwright-mcp). It clicks "Download part N of 190" one at a time, with a 15-second pause between parts.
- **`takeout_worker.py`** is a little HTTP server on `127.0.0.1`, written with nothing but the Python standard library. The browser asks it `GET /state` before every download and tells it what happened with `POST /event`. A separate thread inside it extracts and verifies whatever has landed.

The first version did download, extract, download, extract. Safe, but slow, and the export links expire. I asked Copilot to split them so the browser could keep pulling parts while extraction caught up. That turned out to matter a lot more than I expected (more on part 147 later).

## Trick 1: make Chrome download where you want

The obvious approach is "download, then move to the SSD". That doesn't work when the download itself won't fit on the internal disk. Chrome's temporary `.crdownload` file needs to be on the SSD too.

The fix is a Chrome DevTools Protocol call that tells the browser where to put downloads and to name them by GUID:

```js
const session = await browser.newBrowserCDPSession();
await session.send("Browser.setDownloadBehavior", {
  behavior: "allowAndName",
  downloadPath: initial.staging, // a folder on /Volumes/PortableSSD
  eventsEnabled: true,
  browserContextId,
});
// Playwright MCP's own listener would otherwise save a second copy on the internal disk.
page.removeAllListeners("download");
```

That last line caught us out. The Playwright MCP server has its own download handler that helpfully saves a copy of each download somewhere local. Helpful, unless you're downloading 190 two-gigabyte files to a Mac with a few gigabytes free.

With `eventsEnabled`, you also get `Browser.downloadWillBegin` (which hands you the GUID) and `Browser.downloadProgress` events. The script forwards progress to the worker every 10 seconds, so I could watch it in a terminal rather than staring at the browser.

## Trick 2: backpressure on disk space, not queue length

I deliberately asked for no cap on how many ZIPs could pile up waiting for extraction. Getting the downloads before the export expired was the priority. That doesn't mean unlimited though. The worker refuses the next download unless there's room for it:

```python
blocked = None
if self.state["phase"] != "running" or self.state["downloads_finished"]:
    blocked = "not-running"
elif self.state["download_part"] is not None:
    blocked = "download-active"
elif free < RESERVE + DOWNLOAD_RESERVE:   # 8 GiB + 3 GiB
    blocked = "space"
elif remaining_pause:                     # 15 s since the last part
    blocked = "cooldown"
```

The browser loop just polls `/state` until `can_download` is true. Extraction also checks that there's room for a part's full uncompressed size plus the 8 GiB reserve before it starts. The SSD started with 663 GB free, which is a comfortable margin over 379 GB, but archives and extracted files sit on the disk at the same time, so it's not as generous as it sounds.

A couple of other small things in the worker that I liked:

- It only accepts requests where the `Host` header is `127.0.0.1:18761` and there's no `Origin` header, so some random web page can't post events to it.
- `fcntl.flock` on a lock file means you can't accidentally start two workers.
- Every write checks the SSD's `st_dev`. If the drive is unplugged or something else gets mounted at the same path, it stops rather than happily writing to the wrong disk.

## Trick 3: don't delete anything until you've proved it

This is the bit I cared about most. "Downloaded" isn't the same as "backed up", and I didn't want to throw away a ZIP until I knew its contents were safely on the SSD.

![Lifecycle diagram for one Takeout part: downloading, sniffed, queued, extracting, verified, complete. The sniff step checks whether the file is really a ZIP or a bare video by reading header bytes. Extraction streams each member to a .partial file while hashing, fsyncs, re-reads it to compare SHA-256, handles name collisions by keeping both, re-hashes every destination at the end, writes an atomic receipt and only then deletes the ZIP. A failure lane shows part 147: verification failed on one JPEG, extraction paused with the ZIP kept, downloads of parts 154 to 164 continued, and a retry verified 1,285 files.](/images/post/2026/10/photo-backup-part-lifecycle.webp)

For each file inside a ZIP, the worker streams it out in 1 MiB blocks, hashing as it goes. Python's `zipfile` checks the CRC-32 while reading. Then it reads the file *back* from the SSD and compares hashes:

```python
with bundle.open(member) as source, temporary.open("wb") as output:
    while block := source.read(1024 * 1024):
        output.write(block)
        content_hash.update(block)
        written += len(block)
    output.flush()
    os.fsync(output.fileno())
# ZipFile checks CRC while reading; rereading also verifies the SSD write.
expected_hash = content_hash.hexdigest()
if written != member.file_size or digest(temporary) != expected_hash:
    raise OSError(f"Verification failed for {member.filename!r}")
```

When every file in the part is out, it re-hashes all of them again, writes a receipt (`receipts/part-NNN.json`, listing source path, destination, size and SHA-256) using write-to-temp, `fsync`, rename, and only *then* deletes the ZIP.

Name clashes are common in a Takeout export. If a file with the same name already exists and has the same hash, the new copy is dropped. If the hash is different, both are kept, with the new one renamed to something like `name.takeout-part-147-entry-000123.jpg`. That rename is why the receipts matter later.

The receipts and a `progress.json` file are the source of truth for resuming. Which is handy, because the browser loop lives in memory and every time the browser disconnected, it was gone. A `POST /event {"event": "resume"}` re-queues any saved ZIPs and skips anything with a receipt. Nothing gets downloaded twice.

## The bits that didn't go to plan

**Part 28 wasn't a ZIP.** The worker threw `BadZipFile: File is not a zip file`, and my first thought was a corrupt download. It turned out Google had served one large QuickTime `.MOV` as a part on its own. Part 179 did the same thing later. So now the worker checks what it's actually got rather than trusting the file name:

```python
def recognized_media(path, filename):
    with path.open("rb") as stream:
        header = stream.read(16)
    extension = Path(filename).suffix.lower()
    if extension in (".mov", ".mp4", ".m4v", ".3gp", ".heic", ".heif"):
        return header[4:8] == b"ftyp"
    if extension in (".mkv", ".webm"):
        return header.startswith(b"\x1a\x45\xdf\xa3")
    if extension == ".avi":
        return header.startswith(b"RIFF") and header[8:12] == b"AVI "
    return False
```

A bare video gets hashed, moved into a `Standalone files` folder and hashed again at its new home. Anything that's neither a ZIP nor recognised media stays where it is and the worker stops to let me look.

**Part 147 failed verification.** The final re-hash didn't match for one JPEG from 2017. Extraction paused, the ZIP stayed on the SSD, and (this is where splitting the workers paid for itself) the browser carried on downloading parts 154 to 164 in the meantime. When we looked, the file on disk matched the ZIP exactly. A retry verified all 1,285 files. I don't know what caused the original mismatch and I'm not going to guess. The point is that because the source was still there, I could find out it was fine instead of wondering.

**Restarting the worker mid-download is a bad idea.** At one point we restarted the HTTP server while the browser was halfway through a part. The server's bookkeeping reset, and the browser's next progress event was rejected with `Unexpected download progress`. The README Copilot wrote for the scripts now says not to do that.

**Google wanted my password. A lot.** Every so often the download wouldn't start because the page had bounced to a sign-in screen. The script spots that after two minutes, marks the worker as waiting for authentication, and I type my password. I tried authorising a one-off clipboard paste to save some effort – it didn't work through the automation path, and nothing was stored. I also tried some simulated mouse movement and scrolling to see if it kept the session alive. I have no evidence it made any difference. This was very much an interactive job, not something I kicked off and walked away from.

## Putting the dates back

Once everything was out, the files on the SSD had the dates they were extracted, not the dates the photos were taken. Google puts the real dates in JSON sidecar files next to each photo. Applying them sounds like a five-minute job. It was not.

![Date restoration pipeline. 274,625 receipt records are indexed into SQLite with NFC-normalised, casefolded keys. Sidecar filenames like IMG_0001.jpg.supplemental-metadata(1).json are mapped to IMG_0001(1).jpg, then through receipts to the actual destination. photoTakenTime is preferred over creationTime. Dates before 1980 get their year replaced with 1985 because ExFAT cannot store them, with 29 February flagged. 123,478 files were matched into a plan table that stores the original nanosecond timestamps. apply_dates calls fsetattrlist through ctypes to set creation and modification time, verifies with fstat and restores the originals on mismatch. Parent folders only move earlier.](/images/post/2026/10/photo-backup-dates.webp)

A few of the things that made it interesting:

**Finding which photo a sidecar belongs to.** Google's naming is creative. `IMG_0001.jpg.supplemental-metadata(1).json` belongs to `IMG_0001(1).jpg`, not `IMG_0001.jpg`. And if our extraction renamed a clashing file, the receipts are the only record of where it actually ended up. Everything went into a SQLite database first, with keys normalised to Unicode NFC and case-folded, before a single date was touched. Where names were still ambiguous, the script compared hashes with exact copies in albums. Anything still uncertain was logged, not guessed.

**Which date?** `photoTakenTime` first, then `creationTime`. The fallback can be when the photo was uploaded to Google rather than when it was taken, so it's not perfect.

**macOS creation dates.** Python's `os.utime` sets access and modification time but can't touch a file's birth time on macOS. So Copilot called `fsetattrlist` from libc via `ctypes`:

```python
class AttributeList(ctypes.Structure):
    _fields_ = [("count", ctypes.c_uint16), ("reserved", ctypes.c_uint16),
                ("common", ctypes.c_uint32), ("volume", ctypes.c_uint32),
                ("directory", ctypes.c_uint32), ("file", ctypes.c_uint32),
                ("fork", ctypes.c_uint32)]

ATTR_CMN_CRTIME, ATTR_CMN_MODTIME = 0x200, 0x400
attributes = AttributeList(5, 0, ATTR_CMN_CRTIME | ATTR_CMN_MODTIME, 0, 0, 0, 0)
buffer = (TimeSpec * 2)(TimeSpec(*divmod(created_ns, 10**9)),
                        TimeSpec(*divmod(modified_ns, 10**9)))
libc.fsetattrlist(fd, ctypes.byref(attributes), ctypes.byref(buffer),
                  ctypes.sizeof(buffer), 0)
```

After every call it `fstat`s the file to check the exact nanosecond values stuck. If they didn't, it puts the originals back and raises. The originals are also saved in the SQLite audit before anything changes. Only filesystem metadata is touched. The photo bytes, the EXIF and the JSON sidecars are left alone.

**ExFAT can't do dates before 1980.** I have scanned photos older than that. The filesystem simply can't represent them, so I chose to keep the month, day and time but replace the year with 1985. That's a compromise, not a restoration, and the real date is still in the JSON. It also means 29 February is a problem, since 1985 wasn't a leap year. Those get flagged instead of quietly becoming 1 March.

**Folders only go backwards.** Each folder takes the date of its earliest matched child, but only if that's older than the date it already has. Creation and modification are compared separately so nothing gets accidentally pushed forward.

## Where I've got to

All 190 parts are downloaded, extracted and verified. The receipts hold 274,625 records, but that includes the JSON sidecars and the same photo appearing in several albums, so it's definitely not 274,625 unique photos.

The scripts, tests (which use temporary fixtures and a mocked browser, not my actual Google account) and a README for doing it again are on the SSD in `/src`, with a `SHA256SUMS` file. Browser profiles, cookies, passwords and signed download URLs were deliberately left out.

If you're thinking of doing the same, here's what I'd take away:

- Point the browser's download directory at the destination disk with CDP, and check nothing else (like an MCP server) is saving a copy behind your back.
- Decouple downloading from extraction, and throttle on free space rather than an arbitrary queue length.
- Hash while you write, read it back, and keep the source until you have a durable receipt.
- Sniff file headers. Your export isn't necessarily all ZIPs.
- Write state to disk, not to the browser. Browsers disconnect.

## What's next

One disk is a copy, not a backup plan. The plan is a second, separately verified SSD in a [document box](https://link.amazon/B018mYpAg) at my parents' house, alongside one at home. I haven't done that yet. I also haven't found verified ratings for how well that box protects an SSD, as opposed to paper, so I'm treating it as an extra precaution rather than a guarantee.

The Google originals stay where they are until both copies are verified, and I'll need to plug the disks in now and then to re-check the hashes and actually open a few photos. A backup you've never restored from is really just a hopeful thought.

Now, about that Google Photos storage warning...

---
title: "Backing up a Lifetime of Photos with the GitHub Copilot App"
date: 2026-10-05T12:00:00.000Z
images: ["/images/post/2026/10/lifetime-photo-backup-hero.webp"]
author: "Martin Woodward"
description: "Getting my Google Photos export onto an external SSD with the GitHub Copilot App, and the checks, interruptions and storage tradeoffs along the way."
categories: ["personal", "technology", "ai", "github"]
tags: ["github-copilot", "google-photos", "backup", "python", "macos"]
type: "regular"
draft: true
---

I was running low on Google Photos storage. That prompted a slightly more important question than whether I should buy another chunk of cloud storage: where was my independent copy of all those originals?

Photos are one of those things that accumulate quietly until the thought of losing them becomes rather uncomfortable. I wanted a copy I could hold in my hand, read without signing into an account, and move between my Mac and a Windows machine. Downloading an export sounded like a fairly dull evening's work.

Google Takeout gave me 190 download parts.

This is the story of how I used the GitHub Copilot App to help get those parts onto an external SSD, check what we had extracted, and work through the inevitable surprises. It was not a case of typing "back up my life" and wandering off. Quite a lot of the useful work was in the conversation, especially when I needed to change the plan.

## A disk, an export, and not much room to manoeuvre

I chose an [external SSD](https://link.amazon/B07kuibwP), formatted as ExFAT so I could read it on both Windows and Mac. For this job, being able to plug it into either machine mattered more to me than using a filesystem specific to one platform.

Takeout reported about 378.89 GB. I described that as the uncompressed size during the job, but I wouldn't treat the display as a precise specification of Google's GB/GiB accounting, or as a guarantee of the peak space the process would need. Downloaded archives and extracted files can occupy the disk at the same time.

The SSD initially had 663 GB free. My Mac's internal disk had very little room. That made the download destination a requirement, not a preference.

The plan for physical storage is to keep one copy in a [document box intended to offer protection from fire and water](https://link.amazon/B018mYpAg) at home, and a second copy in a similar box at my parents' house. **Those are future plans.** Copilot has not made that second physical copy or put anything in a box.

I also haven't established independently verified protection ratings for that box, particularly for electronic media. A product described as protecting documents isn't a promise that an SSD inside it will survive a house fire or a flood. I'm treating the boxes as an additional precaution, not a substitute for separate copies.

## The downloads had to land on the SSD

Copilot used a logged-in browser through the Playwright MCP server, alongside scripts written using Python's standard library. The browser handled the authenticated download flow. Python did the file handling, extraction and verification.

The first important lesson was that changing the final destination wasn't enough. If the browser downloaded hundreds of gigabytes to the Mac and we moved them afterwards, we would still run out of internal storage before the move.

We needed the browser's temporary and download paths to point directly to the SSD. There was also a default secondary download-copy listener in the MCP setup, which we disabled so it wouldn't create another copy on the internal disk. All the large files stayed on the external drive.

That's a fairly unglamorous detail, but it was the difference between a workable pipeline and one that would fill my laptop. When using an agent for a storage job, "save it over there" needs to include the temporary files too.

## Two workers, not 190 simultaneous downloads

Initially, each download waited for extraction to finish before the next one started. Safe and easy to follow, but it coupled two jobs that didn't need to wait for each other.

I asked Copilot to separate them:

1. One browser worker downloaded parts sequentially, with a 15-second pause between requests.
2. One extraction worker processed downloaded parts separately, verifying the results before cleaning up verified ZIPs.

This wasn't 190 concurrent browser downloads. It was one download stream and one extraction stream running alongside each other.

![Workflow illustration showing a sequential browser download worker and a separate extraction worker, with temporary files, media and receipts kept on the external SSD.](/images/post/2026/10/photo-backup-workflow.webp)

*The two-worker workflow: keep downloads moving while extraction and verification work through the files already on the SSD.*

I deliberately asked for no artificial cap on the number of ZIPs waiting for extraction. The priority was to secure the downloads before the export expired, rather than leave parts on Google's side while local extraction caught up.

That decision doesn't make storage unlimited. A growing queue still consumes real disk space, so the overlap between archives and extracted content was a tradeoff we had to keep in mind. It was a choice for this job, not a general recommendation to ignore free space.

## Downloaded is not the same as backed up

The useful part of the scripts wasn't just unzipping things. It was making the work checkable and resumable.

ZIP reads checked CRCs. Extracted media were then read back from the SSD and SHA-256 verified against their archive content before a verified ZIP could be removed. Per-part receipts recorded the work, and the JSON sidecars were retained alongside the export.

Filename conflicts needed care too. Two files with the same name aren't necessarily the same photo. Distinct content was preserved rather than overwritten to make the folder look tidy.

The receipts became particularly handy when the browser connection changed. Reconnecting could lose an in-memory job loop. The state written to disk gave us something to inspect before resuming, instead of trusting that the browser remembered exactly where it had got to.

These checks establish something specific: the extracted files match the downloaded source content we checked. They don't independently prove that Google included every original in my account, that every historical upload was an original-resolution file, or that a photo was already healthy before export. Those are different questions.

## The bits that didn't go to plan

Part 28 looked like an extraction problem until we looked at what it actually was. It was a standalone large QuickTime MOV, not a damaged ZIP.

We extended the handler to recognise, verify and relocate raw large videos as well as process archives. The lesson was pretty simple: don't let the assumptions in your script decide what kind of file you've received.

There were also several password and reauthentication prompts, and manual resumptions. This was interactive work. I authorised a one-time clipboard paste, but that didn't work through the browser path. No password or clipboard data was stored.

I experimented with simulated pointer movement and scrolling too. I have no evidence that it prevented logout, and no basis for saying bot detection caused the prompts. It certainly wasn't a way to bypass authentication. When the session needed my attention, it needed my attention.

The most sobering interruption came at part 147. A final verification mismatch paused extraction. That's exactly the sort of situation where I want the process to stop rather than produce a reassuring green tick.

Investigation found that the photo on disk exactly matched its ZIP. The earlier mismatch wasn't reproducible, so I can't honestly tell you what caused it. We kept the original ZIP and retried the verification, which succeeded. I'm not going to turn that into a story about faulty hardware or a Google bug without evidence.

The important design decision was preserving the source until the checks passed. That gave us a way to investigate rather than a mystery and an already-deleted archive.

![Verification review illustration summarising 190 handled and verified parts, 274,625 receipt records rather than unique photos, and the recovery checks for parts 28 and 147. Date application is not yet confirmed.](/images/post/2026/10/photo-backup-verification.webp)

*An illustrated review of the checks and recovery decisions. Verified extraction and completed date restoration are separate milestones.*

## Getting the dates back is a separate job

Once the files were extracted, there was another wrinkle: filesystem dates.

An export can leave you looking at files whose creation or modification dates describe the export rather than when the picture was taken. Google supplies dates in JSON sidecars, but applying those dates safely isn't just a case of matching a filename and calling `os.utime`.

For example, a generic `example.jpg.supplemental-metadata.json` sidecar needs to be matched to the actual destination of `example.jpg`. The receipts matter because a filename conflict may have changed where the extracted file ended up. We handled per-file `.supplemental-metadata.json` and `.json` sidecars through that mapping.

The preferred source is `photoTakenTime.timestamp`. If that's unavailable, `creationTime.timestamp` is the fallback, with the important caveat that Google's upload or import time may not be the camera capture time.

On macOS, `os.utime` alone can't restore a file's birth/creation date. The date-restoration code uses native `fsetattrlist` to set filesystem creation and modification times. It doesn't alter the photo or video contents, embedded EXIF, or the original JSON.

Duplicate names add another complication. Where possible, verified exact-content copies from albums help resolve the mapping. Where the evidence conflicts, the scripts log it rather than guess. An SQLite audit records original filesystem dates and the planned changes.

I also wanted parent folders to move only earlier. The rule uses the earliest successfully matched immediate child date, preserving an already-older creation or modification field independently. There's no reason to make an old folder appear newer just because we're fixing one of its children.

Then there is ExFAT's date limit: it can't store dates before 1980. I explicitly chose **1985** as the replacement year for those older dates, keeping the month, day and time in UTC. That is a compromise, not a restoration of the true year. The original JSON remains unchanged, and February 29 needs flagging because 1985 isn't a leap year.

It's the sort of edge case that makes "just fix the dates" rather more interesting than it sounds.

## Where I've got to

As of 5 October, **all 190 download parts have been downloaded and extracted or handled as raw media, with verification completed**.

The receipts contain 274,625 records. That includes metadata and repeated album copies. It is not a count of 274,625 unique photos.

Filesystem timestamp matching has yielded approximately 124,000 matches. **Date application is not yet confirmed complete.** I've now asked for a best-efforts pass: apply dates only to files already matched, and don't spend more time trying to resolve the others. That pass is being arranged, so I'm not claiming that every photo has had its filesystem dates restored.

The scripts, tests and repeatable instructions have been checksum-verified under `/Volumes/PortableSSD/src`, alongside the work on the SSD. I cancelled automatic disk ejection and asked for the backup background services to stop. The SSD will remain mounted.

That's a useful milestone, but not the end of the backup plan. I still need the second independently verified physical copy and the offsite storage.

## A backup needs a future, not just a finish line

I don't intend to put a disk in a box and assume I've solved this forever. Offline storage still needs periodic integrity checks, sample restores, and refreshing or migration to other media over time. A checksum comparison is useful, but I also want to open representative photos and videos and make sure I can actually use the backup.

The second disk needs its own verification. Until the independent copies are verified, I wouldn't delete the Google originals to reclaim space. Even then, local checks are not proof of full cloud export completeness, so comparing the export with what I expect to have matters too.

What I liked about using the Copilot App was being able to steer a real job as we learnt more about it. "Put everything on the SSD." "Separate downloading from extraction." "Keep the archive until verification passes." "Stop trying to solve every unmatched date."

Those weren't cosmetic changes to a prompt. They were decisions about scarce storage, expiring downloads, uncertain metadata and irreplaceable files.

Copilot was pretty handy at turning those decisions into scripts and helping investigate problems. It didn't remove my responsibility to decide what was safe, respond to authentication prompts, or be honest about what the checks did and didn't prove.

The result is rather satisfying: a verified local copy of the export, a record of how it got there, and a much clearer plan for keeping it useful. Not magic. Just a lot less repetitive clicking, and considerably more checking than I would want to do by hand.

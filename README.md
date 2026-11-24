# OET Prep Course · Elevate with Ms. Maria · Learnovate Qatar

A 12-session course website for the **Occupational English Test (OET)**, for healthcare professionals who need OET for registration or a visa. The profession focus is **Nursing**: Listening and Reading are the same for every profession, and the Writing and Speaking material comes from a profession file, so you can add other professions later.

- **Students** sign in with an access code you give them. They don't need an account.
- **The Teacher Portal** (`#teacher`, password protected) is where you create batches, add students and give them codes, follow their progress, read their letters, listen to their role-plays, rate mock tests and send feedback.
- **The site** is hosted on GitHub Pages. **The data** is kept in a Google Sheet through Google Apps Script.

```
index.html              the whole website (one file)
professions/nursing.js  Nursing case notes, letters, role-plays and sample letters
mocks/mock1.js …        the full mock tests
apps-script/Code.gs     the backend you paste into Google Apps Script
tests/                  automated checks (Playwright), not needed to run the site
```

This is an independent course. It is not affiliated with or endorsed by OET or Cambridge Boxhill Language Assessment. All case notes, recordings, texts and role-plays are original.

## 1. Set up the Google Sheet and Apps Script (about 10 minutes)

1. Create a Google Sheet and name it **OET Prep Course Data**.
2. Open **Extensions → Apps Script**. Delete the sample code, paste in everything from `apps-script/Code.gs`, and click **Save**.
3. Go back to the Sheet tab and **reload the page**. A new menu called **OET Course** appears, next to Help.
4. Use the menu items in this order:
   1. **OET Course → 1. Set teacher password.** The first time, Google asks you to authorize: click **Continue**, choose your account, click **Advanced → Go to (project name)**, then **Allow**. Run the menu item again, type your password and click **OK**.
   2. **OET Course → 2. Set up sheets.** This creates the Batches, Students, Progress, Feedback, Messages, Settings and MockScores tabs.
   3. **OET Course → 3. Send me a test email.** You receive an email, which confirms the course can email students.
   4. **OET Course → Check setup.** Every line should show ✅.
5. Deploy the web app, back in Apps Script:
   - Click **Deploy → New deployment**, then the gear icon → **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy** and copy the URL that ends in `/exec`.

**Passwords and keys never go in the code.** The teacher password and the optional Claude API key are saved in **Script Properties** (Apps Script → Project Settings → Script properties) by the menu items above. Don't type them into `Code.gs` or `index.html`, and don't commit them.

## 2. Connect the website

Open `index.html`, find these lines near the top of the `<script>`, and paste in your URL:

```js
API_URL:'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
PROFESSION:'nursing'
```

The web app URL isn't secret (students' browsers need it), but the password is, and it stays in Script Properties.

## 3. Publish on GitHub Pages

1. Make sure `index.html`, `.nojekyll` and the `professions/` and `mocks/` folders (and later `decks/` and `downloads/`) are in the `main` branch.
2. In the repository, go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
3. After a minute, the site is live at `https://learnovateqa.github.io/OET/`.

## 4. Run a batch

1. Open the site, click **Teacher portal**, and sign in with your password.
2. Click **+ New batch**, then **+ Add student**. Enter their name, email and phone. Keep the generated code (for example `OET-7KQ2MZ`) or type your own.
3. Click **Copy message** and send it by email, text or WhatsApp, or tick **Email the access code**.
4. The student opens the link, types the code, and their dashboard opens.

## Teacher Portal

- **Teaching** (your home page): your next class for each batch, and **Course readiness**, which shows for every session whether the Canva deck, PowerPoint, teacher guide and live tools are ready.
- **Students & Batches**:
  - **Teach a session** opens a session's *In class* tab: slides, live tools, the teaching plan and the teacher guide, which only you can see (Say / Ask / Watch for / timing tip).
  - **Inbox** shows new student messages and letter-task replies.
  - **Slide decks**: download each PowerPoint, import it into Canva (**Create a design → Import file**), then paste the Canva **Share → More → Embed** link and click **Save**.
  - **Session schedule**: open, lock or date each session for a batch.
  - **Student detail** shows scores, the Error Log with a coaching focus, letters, recordings, messages and feedback.
- **Mock test ratings**: rate Writing on the six OET criteria (Purpose 0–3; Content, Conciseness & Clarity, Genre & Style, Organisation & Layout, and Language 0–7). Rate each Speaking role-play on the four linguistic criteria (0–6) and the five clinical communication criteria (0–3). The site converts your ratings to an estimated score on the 0–500 scale and a grade.
- **Remove this attempt** deletes a mock attempt (answers, scores, Error Log entries and your ratings). It stays removed, even if the student's device has an older copy.

## Scoring (practice estimates)

- Each sub-test is reported from **0 to 500**, in steps of 10, with grades A (450–500), B (350–440), C+ (300–340), C (200–290), D (100–190) and E (0–90). Most boards ask for **B (350)**.
- **Listening and Reading** (42 questions each) are marked automatically. The raw score is converted with an approximate chart (about 30/42 ≈ 350). The official conversion isn't published, so the course calls it an estimate.
- **Writing and Speaking** are rated by you. The conversions are anchored to the OET guides: grade B is about 2/3 for Purpose and 5/7 for the other Writing criteria, and mostly 5/6 (linguistic) and 2/3 (clinical communication) in Speaking.
- Mock role-play recordings are uploaded to your Google Drive, in **OET Course Recordings**, with one folder per student.

## AI scoring for letters (optional, Claude)

When it's turned on, a submitted letter gets an estimated score and grade, a band for each of the six criteria with evidence, a check of which case-note points were included, missing or not needed, sentence fixes, a corrected version and what to study next.

1. Create an API key at **console.anthropic.com** (add credit under Billing first).
2. In the Sheet: **OET Course → 4. Turn on AI scoring (Claude API key)**, then paste the key. It's saved in Script Properties, not in the code.
3. Each student can score up to 10 letters a day. To change this, edit `AI_DAILY_LIMIT` in `Code.gs`. Without a key, students use the self-check checklist instead.

## Adding another profession

1. Copy `professions/nursing.js` to, for example, `professions/medicine.js`. Change `id` and `name`, and write that profession's case notes, role-plays and sample letters in the same format.
2. Add `<script src="professions/medicine.js"></script>` next to the nursing one in `index.html`.
3. Set `PROFESSION:'medicine'` in `CONFIG`. To run two professions at once, publish a second copy of the site with its own setting.

## Updating Code.gs

1. In Apps Script, replace all the code with the new `apps-script/Code.gs` and click Save.
2. Reload the Sheet, then use **OET Course → 2. Set up sheets** to add any new tabs.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** The URL stays the same.

## Automated checks (for developers)

`tests/gas-stub.js` runs `Code.gs` in Node with an in-memory stand-in for Google Sheets. `tests/crawl.js` opens every page as a student and as the teacher, at desktop and phone widths and in light and dark mode. It reports page errors, broken text (such as `NaN`) and sideways scrolling.

```bash
node tests/crawl.js
```

## Good to know

- **Privacy:** an access code is the student's key, so keep codes private. Only your Google account can see the Sheet.
- **Offline:** if a student goes offline, their practice is kept on their device and saved automatically when they're back online.
- **Listening audio** uses the browser's built-in voices, with a female or male voice to match each speaker. Each recording plays once. Chrome and Edge have the most natural voices.

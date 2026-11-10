# PDF Overlayer

Mark rooms on a PDF floor plan with transparent colours, add a labelled legend, and export a PDF at the original page size and scale. You can draw complex room outlines using straight and curved edges.

The tool runs on your computer in a web browser. Your PDFs are processed in the browser and are not uploaded to a service. There is no account to create.

## Before you start

You will need:

- A Windows, macOS or Linux computer. A mouse or trackpad is useful for tracing rooms.
- An up-to-date desktop web browser, such as Chrome or Edge.
- **Node.js and npm**, installed using the instructions below. These run the tool on your computer.
- An internet connection for the initial download and installation.

This version is supplied as a project folder rather than a desktop installer. You will use a terminal to start it; you do not need to edit any code or install Git.

## First-time setup

### 1. Install Node.js

Go to the [official Node.js download page](https://nodejs.org/en/download) and install a release marked **LTS** for your operating system. Use Node.js 24 or a newer LTS release. If you already have Node.js 22, it must be version 22.13.0 or later.

The Node.js installer also installs **npm**. Follow the installer prompts, then close and reopen any terminal windows you already had open.

To check the installation, open **Terminal** on macOS or Linux, or **Command Prompt** on Windows, and run these commands one at a time:

```sh
node --version
npm --version
```

Each command should print a version number. For example, `v24.x.x` for Node.js; the actual numbers will vary. If either command is not recognised, see [Troubleshooting](#troubleshooting).

### 2. Download PDF Overlayer

1. Open the [PDF Overlayer project on GitHub](https://github.com/lewb-ox/pdf-overlayer). Sign in if GitHub asks you to.
2. Select **Code**, then **Download ZIP**.
3. Extract the ZIP into a folder you can keep, such as your Documents folder. On Windows, use **Extract All**; on macOS, double-click the ZIP.
4. Open the extracted folder. It will normally be called `pdf-overlayer-main`. You should see files including `README.md`, `package.json` and `package-lock.json`.

If someone has already given you an extracted copy of the project, use that folder and skip the download.

### 3. Open a terminal in the project folder

The terminal needs to be in the folder containing `package.json`.

- **Windows:** open that folder in File Explorer, click the address bar, type `cmd`, then press Enter. A Command Prompt opens in that folder.
- **macOS:** open Terminal, type `cd` followed by a space, drag the extracted project folder from Finder into the Terminal window, then press Enter.
- **Linux:** open a terminal in the extracted folder using your file manager, or use `cd` to move into it.
- **If using VS Code:** open the project folder, then select **Terminal → New Terminal**.

### 4. Install the tool's components

In that terminal, run:

```sh
npm ci
```

Wait until the command finishes and the terminal prompt returns. This downloads the versions recorded in the project's lock file, as described in the [npm installation documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/). You normally only need to do this during setup or after downloading an updated version of the tool.

### 5. Start the tool

Run:

```sh
npm run dev
```

The terminal should show a **Local** address, usually:

```text
http://127.0.0.1:5173/
```

Open the address shown in your browser. Use the address from your terminal if its port number is different. Keep the terminal open while you use the tool.

You should now see an example floor plan with several coloured rooms. You can try the tools on this example before opening your own PDF. Opening `index.html` directly will not start the tool.

## Starting and stopping next time

To use the tool again:

1. Open a terminal in the same project folder, as described in step 3 above.
2. Run `npm run dev`.
3. Open the **Local** address in your browser.
4. If you saved an editable project previously, use **Open PDF** to load it.

To stop, save your project, return to the terminal and press **Ctrl+C**. On Windows, confirm if asked to terminate the batch job. You can then close the terminal and browser tab.

**Save before closing, refreshing the browser or stopping the tool. Changes are not saved automatically.**

## Marking your first plan

1. Select **Open PDF** and choose your plan. You can also drag a PDF into the editor.
2. Choose a category in the **Colour key**. Click a colour swatch to change its colour, the pencil to edit its label, or **+** to add a category. Use **Opacity** to adjust transparency for all rooms in the selected category.
3. Select **Straight edge** and click around a room's corners. Click your first point again, or press **Enter**, to close the shape. You need at least three distinct points enclosing an area.
4. For a curved edge, select **Curved edge**, click the curve's endpoint, then click to place its bend. You can switch between straight and curved tools within one room. To curve the closing edge, click the first point and then place the bend.
5. Select **Select**, then click a room to edit it. Drag its white points to adjust corners or its gold handles to adjust curves. Use the side panel to change the room's name or category. The eye buttons hide or show rooms.
6. Drag the **legend** to a clear space on the plan. It lists the visible categories used on the current page. Its position and visibility can be set separately for each page.
7. Use the page selector for plans with several pages. **Zoom**, **Pan** and **Fit page** help you trace accurately. Finish or cancel the current room before changing pages.

On smaller screens, use the menu button above the plan to open the colours and rooms panel. The **?** button opens drawing help.

## Saving your work and exporting a PDF

There are two ways to save, depending on what you need:

| Action | What you receive | When to use it |
| --- | --- | --- |
| **Save editable project** — the save icon beside Open PDF | An `.overlayer.json` file containing your original PDF, room shapes, colours and legend settings | To continue editing later. Reopen it using **Open PDF**. |
| **Export PDF** | A PDF containing your original plan, visible room colours and legends | To share, view or print the finished plan. Keep an editable project too if you may need to revise it. |

Files are downloaded through your browser, normally to your Downloads folder unless you choose another location. Saving does not overwrite the original plan. Hidden rooms are excluded from the exported PDF and its legends.

Finish or cancel any unfinished shape before saving or exporting. Save an editable project regularly; the tool does not restore unsaved changes after a refresh or restart.

### Keeping the plan's scale when printing

PDF export preserves the original page dimensions and existing plan content, including rotated or cropped pages. It adds the overlays without turning the plan into an image.

When printing, choose **Actual size** or **100%**. **Fit to page** can change the physical scale. The tool preserves the scale already present in the PDF; it does not check or calibrate the drawing's measurements.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| `node` or `npm` is not recognised, or you see `command not found` | Install Node.js LTS, then close and reopen your terminal. Run `node --version` and `npm --version` again. |
| A warning mentions `EBADENGINE` or an unsupported Node.js version | Install Node.js 24 or a newer LTS release, reopen the terminal and run `npm ci` again. |
| An error mentions `ENOENT` or a missing `package.json` | Your terminal is in the wrong folder. Open it in the extracted folder that contains `package.json`, then retry. |
| Windows PowerShell says `npm.ps1` cannot run because scripts are disabled | Use **Command Prompt** as described above. Alternatively, use `npm.cmd ci` and `npm.cmd run dev` in PowerShell. |
| Installation fails with a network, certificate or proxy error | Check your internet connection. On a managed computer or network, ask your IT support team whether npm downloads are permitted. Retry `npm ci` once the connection is working. |
| The browser cannot connect to the Local address | Check that `npm run dev` is still running, then copy the exact Local address from the terminal. If the terminal was closed, start the tool again. |
| The address uses a port other than `5173` | Another application may be using that port. Open the address actually printed in the terminal. |
| Save or Export is disabled | Finish the shape using **Enter** or **Close shape**, or press **Esc** to cancel it. Wait for any opening or exporting operation to finish. |
| A PDF will not open | Password-protected PDFs are not supported. Save an unprotected copy first. PDF files must be no larger than 100 MB; saved projects must be no larger than 160 MB. |
| Export reports an unsupported label character | Legend labels currently support Latin letters, numbers and punctuation. Replace the character identified in the error and retry. |
| A room or category is missing from the exported plan or legend | Check the room's eye button. The legend only includes categories used by visible rooms on that page. Also check that the page's **Plan legend** switch is on. |
| Export says the legend is too tall | Shorten the category labels, use fewer categories on that page, or switch off that page's legend before exporting. |

## Updating your copy

Save any open work as an editable project first. Download and extract a fresh copy of the project into a new folder, then repeat setup steps 3–5 in that folder. Open your saved `.overlayer.json` file to continue working. Keep your saved projects somewhere you can find them independently of the application folder.

## Keyboard shortcuts

Use **Cmd** on macOS or **Ctrl** on Windows/Linux where shown.

| Action | Shortcut |
| --- | --- |
| Select | V |
| Straight edge | P |
| Curved edge | C |
| Pan | H |
| Close shape | Enter |
| Cancel shape / clear selection | Esc |
| Remove latest point or pending curve endpoint | Backspace |
| Delete selected room | Delete / Backspace |
| Undo | Cmd/Ctrl Z |
| Redo | Cmd/Ctrl Shift Z |
| Save editable project | Cmd/Ctrl S |

Development and hosting information is in the [developer README](README-DEVELOPERS.md).

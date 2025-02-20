# Tinector

A plugin to connect cards together.

<img width="1564" alt="Screenshot 2025-02-20 at 12 09 48" src="https://github.com/user-attachments/assets/61861ce8-4edf-4271-a935-195752804581" />


## To get started

In Figma, open up the Actions menu `Cmd K` and navigate to `Plugins & Widgets`. 

Scroll down or search for `Import from manifest`. This will open up your filepicker. 

Navigate to the `Tinector` repository add select the `manifest.json` file from `tinector/public`. 

This adds the `development` version of the plugin for you to use.

## How to use

Select two `card` instances and press `Connect`to establish a connection between cards.

The plugin is currently setup to establish connections between cards only so make sure its an instance that you select.

When the plugin is open, you can select a `card`, move it around, and connections will be auto updated.

*Minor bug:* Vertical lines will result in the appearance of a solid color. For some reason the gradient gets flipped around, so you'll need to manually adjust. SOZ.

To remove connections, click the cog. This will display the list of connections that exist in the document. Click to delete. In the future I'll add the ability to click and focus on the actual connection itself, TBD.

Connection data is stored on the document level, so it _should_ be possible to share connections across different users / Figma instances.

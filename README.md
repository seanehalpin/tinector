# Tinector

A plugin to connect cards together.


## To get started

In Figma, oprn up the Actions menu `Cmd K` and navigate to `Plugins & Widgets`. 

Scroll down or search for `Import from manifest`. This will open up your filepicker. 

Navigate tot he Tinector repository add select the `manifest.json` file from `tinector/public`. 

This adds the `development` version of the plugin for you to use!

## How to use

Select two `card` instances and press `Connect`to establish a connection between cards.

The plugin is currently setup to establish connections between cards only so make sure its an instance that you select.

When the plugin is open, you can select a `card`, move it around, and connects will be auto updated.

*Minor bug:* Vertical lines will result in the appearance of a solid color. For some reason the gradient gets flipped around, you'll need to manually adjust. SOZ.

To remove connections, click the cog. This will display the list of connections that exist in the document. Click to delete. In the future I'll addd a the ability to click and focus on the actual connection itself, TBD.

Connection data is stored on the document level, so it _should_ be possible to share connections across different users.
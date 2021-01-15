# What is Pelagius?

Pelagius is a Discord bot that was originally written for Evertiro's
[LOTD Plus Skyrim modding guide](https://lotdplus.com). This later expanded to
[Lexy's Legacy of the Dragonborn guide](https://lexyslotd.com) as well as
[The Phoenix Flavour](https://thephoenixflavour.com). Originally, the wasn't
actually a bot at all, just me running a python script manually to compare my
own loadorder to that of other users when they uploaded it. Naturally, the
problem with that is that I have to be there all the time to run my script.
I then decided to start developing a standalone Discord bot written in
Discord.py to accomplish the same thing, but automatically. I later switched
over to Discord.js, as well as implemented a few other features, such as being
able to ignore certain plugins in the list. However, that's the past. Let's talk
about now and the future.

## What does it do?

Basically it lets your users upload a loadorder.txt file and compare it to a
master file.

* Staff upload a "master" loadorder.txt to be compared to (generated by MO2)
* Users can upload a loadorder.txt and it will be analyzed
  * This analysis will tell them what plugins they shouldn't have and what
    they're missing compared to the master list
* Staff can pause and resume validation, useful for updates to the list
* Staff can upload a "skips" file which contains a list of plugins to ignore
* Staff can upload a "reasons" JSON file which is used to tell users why a
  certain plugin is missing or extra
* Old versions of uploaded staff files are automatically archived
* Properly supports multiple Discord servers, keeping staff lists and master
  files separate
* User help info can be found by running `!loadorder help` in an approved channel
* A full list of staff commands can be found by running `!loadorder staffhelp`

## How do I set it up?

First, click [here](https://discord.com/api/oauth2/authorize?client_id=714232981774139442&permissions=100352&scope=bot)
to add Pelagius to your server. Select the server you want to add the bot to,
and ensure that the check boxes for the "Send Messages," "Attach Files," and
"Read Message History" permissions are selected. Finally, click the "Authorize"
button to add the bot to your server.

Once the bot has joined the server, you need to do a couple of things.

If you're not the server owner, you'll need to be added as "staff" for the bot.

* Have the server owner run the command `!loadorder staff add [@your-name]`

You'll need at least one channel in which the bot is allowed to check load order.

* Go to that channel, and run the command `!loadorder channel add`

Finally, you need a master file

* Get your loadorder.txt ([example](example/loadorder.txt)) (generated by MO2)
  and upload it with the command `!loadorder file update loadorder`

That's it, Pelagius is ready to run!

If you want, you can also upload a "skips" and "reasons" file using the command
`!loadorder file update [file]`.

* The skips file ([example](example/skips.txt)) will ignore all listed filenames
  (files should be entered one per line)
* The reasons file ([example](example/reasons.json)) will provide reasons to
  your users as to why they shouldn't have a certain file (it needs to be JSON)

I also suggest setting the loadorder path so your users know where to get the
loadorder.txt file. To do this, run `!loadorder settings path [c:\your\path]`

## Necessary setup for development testing

Create a file called `.env` in the same directory as `pelagius.js` and add the
following line to it, replacing `{your token}` with the token found in the bot
section of [your application](https://discord.com/developers/applications/):

```env
BOT_TOKEN="{your token}"
```

Run `npm install` from the bot directory to install development dependencies.

"use strict";

var milieu = require('milieu');
var config = milieu('pelagius', {
    bot: {
        prefix: '!'
    }
});

const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');
const https = require('https');

const token = config.bot.token;
const logChannel = config.bot.log_channel;
const prefix = config.bot.prefix;

let types = new Map();
types.set('loadorder', 'loadorder.txt');
types.set('reasons', 'reasons.json');
types.set('skips', 'skips.txt');

var staffUsers = new Map();
var approvedChannels = new Map();
var settings = new Map();

class Settings {
    constructor(enabled, path, types) {
        this._enabled = (enabled === 'true');
        this._path = path;
        this._fileTypes = types;
    }

    toString() {
        let types = '';
        this._fileTypes.forEach((value, key) => {
            types += key + ',' + value;
        });
        return this._enabled + '\n' + this._path + '\n' + types;
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(bool) {
        this._enabled = (bool === 'true');
    }

    get path() {
        return this._path;
    }

    set path(str) {
        this._path = str;
    }

    get fileTypes() {
        return this._fileTypes;
    }

    set fileTypes(types) {
        this._fileTypes = types;
    }
}

function getFileNameFromFileType(guild, fileType) {
    let guildSettings = settings.get(guild.id);
    let guildTypes = guildSettings.fileTypes;

    return types.get(fileType) !== undefined ? types.get(fileType) : guildTypes.get(fileType);
}

function getExtensionFromFileType(guild, fileType) {
    let fileName = getFileNameFromFileType(guild, fileType);
    if (fileName === undefined) {
        return null;
    }
    let index = fileName.indexOf('.');
    return fileName.substring(index, fileName.length);
}

function getChannel(id) {
    return client.channels.cache.get(id);
}

function logMessage(msg) {
    getChannel(logChannel).send(msg);
}

function getGuildStr(guild) {
    return '`G:' + guild.name + '(' + guild.id + ')`';
}

function getChannelStr(channel) {
    let type = channel.type;
    let ret = '`';
    if (type === 'text') {
        ret += 'TC';
    } else if (type === 'voice') {
        ret += 'VC';
    } else if (type === 'dm') {
        ret += 'DM';
    } else if (type === 'news') {
        ret += 'NC';
    } else {
        ret += 'C';
    }
    ret += ':' + channel.name + '(' + channel.id + ') / `' + getGuildStr(channel.guild) + '';
    return ret;
}

function getMember(guild, id) {
    return guild.members.cache.get(id);
}

function getUserStr(user) {
    return '`U:' + user.username + '(' + user.id + ')`';
}

function getMemberStr(member) {
    let guild = member.guild;
    let user = member.user;
    let nick = member.nickname;
    if (nick === null) {
        nick = user.username;
    }
    return '`MB:' + nick + '(`' + getUserStr(user) + '` / `' + getGuildStr(guild) + '`)`';
}

function getMemberStrFromId(guild, id) {
    return getMemberStr(getMember(guild, id));
}

async function saveChannels(guild) {
    return fs.promises.writeFile('./data/' + guild.id + '/channels.dat', Array.from(approvedChannels.get(guild.id)).toString());
}

async function saveStaff(guild) {
    return fs.promises.writeFile('./data/' + guild.id + '/staff.dat', Array.from(staffUsers.get(guild.id)).toString());
}

async function saveSettings(guild) {
    return fs.promises.writeFile('./data/' + guild.id + '/settings.dat', settings.get(guild.id).toString());
}

async function loadChannels(guild) {
    return fs.promises.readFile('./data/' + guild.id + '/channels.dat', 'utf8').then((data) => {
        let guildChannels = [];
        data.split(',').forEach((userID) => {
            guildChannels.push(userID);
        });
        approvedChannels.set(guild.id, guildChannels);
        logMessage('Loaded approved channels from ' + getGuildStr(guild) + ' to memory');
    }).catch(() => {
        approvedChannels.set(guild.id, []);
        saveChannels(guild).then(() => {
            logMessage('Saved approvedChannels for ' + getGuildStr(guild));
        }).catch((err) => {
            logMessage('Error: Failed to save approvedChannels for ' + getGuildStr(guild) + '\n' + err);
            console.log(err);
        });
    });
}

async function loadStaff(guild) {
    return fs.promises.readFile('./data/' + guild.id + '/staff.dat', 'utf8').then((data) => {
        let guildStaff = [];
        data.split(',').forEach((userID) => {
            guildStaff.push(userID);
        });
        staffUsers.set(guild.id, guildStaff);
        logMessage('Loaded staff members from ' + getGuildStr(guild) + ' to memory');
    }).catch(() => {
        staffUsers.set(guild.id, [guild.ownerID]);
        saveStaff(guild).then(() => {
            logMessage('Saved staff for ' + getGuildStr(guild));
        }).catch((err) => {
            logMessage('Error: Failed to save staffUsers for ' + getGuildStr(guild) + '\n' + err);
            console.log(err);
        });
    });
}

async function loadSettings(guild) {
    return fs.promises.readFile('./data/' + guild.id + '/settings.dat', 'utf8').then((data) => {
        let lines = data.toString().split(/\r?\n/);
        let files = new Map();
        if (lines.length > 2) {
            for (let i = 2; i < lines.length; i+=1) {
                let types = lines[i].split(',');
                files.set(types[0], types[1]);
            }
        }
        settings.set(guild.id, new Settings(lines[0], lines[1], files));
        logMessage('Loaded settings for ' + getGuildStr(guild) + ' to memory');
    }).catch(() => {
        settings.set(guild.id, new Settings('true', 'MO2/profiles/[profile]/loadorder.txt', new Map()));
        saveSettings(guild).then(() => {
            logMessage('Created new settings for ' + getGuildStr(guild));
        }).catch((err) => {
            logMessage('Error: Failed to save settings for ' + getGuildStr(guild) + '\n' + err);
            console.log(err);
        });
    });
}

async function createDirectory(path) {
    return fs.promises.mkdir(path, { recursive: true });
}

function setup() {
    client.guilds.cache.forEach((guild) => {
        createDirectory('./data/' + guild.id).then(() => {
            loadChannels(guild).then(() => {
                let guildChannels = approvedChannels.get(guild.id);
                if (guildChannels.length === 1 && guildChannels[0] === '') {
                    guildChannels.pop();
                }
                approvedChannels.set(guild.id, guildChannels);
            }).catch((err) => {
                logMessage('Error: Failed to load channels for ' + getGuildStr(guild) + '\n' + err);
                console.log(err);
            });
            loadStaff(guild).catch((err) => {
                logMessage('Error: Failed to load staff for ' + getGuildStr(guild) + '\n' + err);
                console.log(err);
            });
            loadSettings(guild).catch((err) => {
                logMessage('Error: Failed to load settings for ' + getGuildStr(guild) + '\n' + err);
                console.log(err);
            });
        });
    });
}

function isStaff(guild, userID) {
    let guildStaff = staffUsers.get(guild.id);
    return guildStaff.includes(userID);
}

function isValidFile(guild, fileType) {
    return getFileNameFromFileType(guild, fileType) !== undefined;
}

async function archiveFile(guild, fileType) {
    let folder = './data/' + guild.id + '/archive/' + fileType;
    let filePath = './data/' + guild.id + '/' + getFileNameFromFileType(guild, fileType);

    await createDirectory(folder);
    let stats = await fs.promises.stat(filePath);
    let time = stats.mtime.toDateString().replace(/ /g, '_');
    return fs.promises.rename(filePath, folder + '/' + fileType + '_' + time + getExtensionFromFileType(guild, fileType));
}

async function archiveIfNeeded(guild, fileType) {
    let filePath = './data/' + guild.id + '/' + getFileNameFromFileType(guild, fileType);
    return fs.promises.access(filePath, fs.constants.F_OK).then(() => archiveFile(guild, fileType)).catch(() => { });
}

async function updateFile(guild, fileType, url) {
    await archiveIfNeeded(guild, fileType);
    let file = fs.createWriteStream('./data/' + guild.id + '/' + getFileNameFromFileType(guild, fileType));
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            response.on('error', (err) => {
                reject(err);
            });
            response.pipe(file);

            if (fileType === 'reasons') {
                let content = '';
                response.on('data', (chunk) => {
                    content += chunk;
                });

                response.on('end', () => {
                    try {
                        let json = JSON.parse(content);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            } else {
                resolve();
            }
        });
    });
}

async function addApprovedChannel(guild, channelID) {
    let guildChannels = approvedChannels.get(guild.id);
    guildChannels.push(channelID);
    approvedChannels.set(guild.id, guildChannels);
    return new Promise((resolve, reject) => {
        saveChannels(guild).then(() => {
            logMessage(getChannelStr(getChannel(channelID)) + ' added as an approved channel');
            resolve();
        }).catch((err) => {
            logMessage('Error: Failed to save adding ' + getChannelStr(getChannel(channelID)) + ' as an approved channel\n' + err);
            console.log(err);
            reject();
        });
    });
}

async function removeApprovedChannel(guild, channelID) {
    let guildChannels = approvedChannels.get(guild.id);
    guildChannels.splice(guildChannels.indexOf(channelID), 1);
    approvedChannels.set(guild.id, guildChannels);
    return new Promise((resolve, reject) => {
        saveChannels(guild).then(() => {
            logMessage(getChannelStr(getChannel(channelID)) + ' removed as an approved channel');
            resolve();
        }).catch((err) => {
            logMessage('Error: Failed to save removing ' + getChannelStr(getChannel(channelID)) + ' as an approved channel\n' + err);
            console.log(err);
            reject();
        });
    });
}

function isApprovedChannel(guild, channelID) {
    let guildChannels = approvedChannels.get(guild.id);
    return guildChannels.includes(channelID);
}

async function addStaff(guild, userID) {
    let guildStaff = staffUsers.get(guild.id);
    guildStaff.push(userID);
    staffUsers.set(guild.id, guildStaff);
    return new Promise((resolve, reject) => {
        saveStaff(guild).then(() => {
            logMessage(getMemberStrFromId(guild, userID) + ' added as a staff member');
            resolve();
        }).catch((err) => {
            logMessage('Error: Failed to save adding ' + getMemberStrFromId(guild, userID) + ' as a staff member\n' + err);
            console.log(err);
            reject();
        });
    });
}

async function removeStaff(guild, userID) {
    let guildStaff = staffUsers.get(guild.id);
    guildStaff.splice(guildStaff.indexOf(userID), 1);
    staffUsers.set(guild.id, guildStaff);
    return new Promise((resolve, reject) => {
        saveStaff(guild).then(() => {
            logMessage(getMemberStrFromId(guild, userID) + ' removed as a staff member');
            resolve();
        }).catch((err) => {
            logMessage('Error: Failed to save removing ' + getMemberStrFromId(guild, userID) + ' as a staff member\n' + err);
            console.log(err);
            reject();
        });
    });
}

async function compare(guild, content, skips, reasons) {
    return new Promise((resolve, reject) => {
        fs.promises.readFile('./data/' + guild.id + '/loadorder.txt', 'utf8').then((data) => {
            let dataLines = data.toLowerCase().split(/\r?\n/);
            let contentLines = content.toLowerCase().split(/\r?\n/);
            let response = '';
            let temp = 'Your loadorder is missing:\n';

            dataLines.forEach((line) => {
                if (line.trim() === '') {
                    return;
                }
                if (!contentLines.includes(line)) {
                    if (!skips.includes(line)) {
                        temp += line + '\n';
                    }
                }
            });

            if (temp !== 'Your loadorder is missing:\n') {
                response = temp;
            }

            temp = '\nYour loadorder should not have:\n';

            contentLines.forEach((line) => {
                if (line.trim() === '') {
                    return;
                }
                if (!dataLines.includes(line)) {
                    if (!skips.includes(line)) {
                        temp += line;
                        if (reasons.hasOwnProperty(line)) {
                            temp += reasons[line];
                        }
                        temp += '\n';
                    }
                }
            });

            if (temp !== '\nYour loadorder should not have:\n') {
                response += temp;
            }

            resolve(response);

        }).catch((err) => {
            reject(err);
        });
    });
}

async function prepCompare(guild, content) {
    let skipLines;
    let reasonJSON;
    try {
        let skips = await fs.promises.readFile('./data/' + guild.id + '/skips.txt', 'utf8');
        skipLines = skips.toLowerCase().split(/\r?\n/);
    } catch (e) {
        skipLines = [];
    }

    try {
        let reasons = await fs.promises.readFile('./data/' + guild.id + '/reasons.json', 'utf8');
        reasonJSON = JSON.parse(reasons.toLowerCase());
    } catch (e) {
        reasonJSON = JSON.parse('{}');
    }

    return compare(guild, content, skipLines, reasonJSON);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('Bethesda games');

    logMessage('Bot starting...');
    setup();
});

// Add guild owner to staff list when bot joins a new server
client.on('guildCreate', (guild) => {
    logMessage('Bot joined a new guild: ' + getGuildStr(guild));
    createDirectory('./data/' + guild.id).then(() => {
        loadStaff(guild);
        loadChannels(guild);
        loadSettings(guild);
    });
});

client.on('message', async (message) => {
    // Disallow DMs to bot
    if (message.guild === null) {
        return;
    }

    if (!message.content.toLowerCase().startsWith(prefix + 'loadorder')) {
        return;
    }

    let args = message.content.toLowerCase().split(' ');
    if (args.length === 1) {
        if (!isApprovedChannel(message.guild, message.channel.id)) {
            return;
        }

        fs.promises.access('./data/' + message.guild.id + '/loadorder.txt', fs.constants.R_OK).then(() => {
            let guildSettings = settings.get(message.guild.id);
            if (!guildSettings.enabled) {
                message.channel.send('Loadorder validation is currently disabled');
                return;
            }

            if (message.attachments.size !== 1) {
                message.channel.send('You must attach your loadorder file in the same message as `' + prefix + 'loadorder`\n' +
                    'The file is located at `' + guildSettings.path + '`');
                return;
            }

            if (message.attachments.first().name !== 'loadorder.txt') {
                message.channel.send('The file must be named `loadorder.txt`, you should drag and drop it directly from your MO2 installation');
                return;
            }

            let url = message.attachments.first().url;
            https.get(url, (response) => {
                response.on('error', (err) => {
                    message.channel.send('There was an error retrieving the file, contact Robotic');
                    logMessage('Error: Failed to retrieve loadorder file from web in ' + getChannelStr(message.channel) + '\nURL: ' + url + '\n' + err);
                    console.log(err);
                });

                let content = '';
                response.on('data', (chunk) => {
                    content += chunk;
                });

                response.on('end', () => {
                    prepCompare(message.guild, content).then((diffs) => {
                        if (diffs === '') {
                            message.channel.send(message.author.toString() + ', your loadorder matches the master list, no problems there!');
                            return;
                        }
                        let buf = Buffer.from(diffs, 'utf8');
                        let attachment = new Discord.MessageAttachment(buf, 'differences.txt');
                        message.channel.send(message.author.toString() + ', here\'s what you need to fix:', attachment);
                    }).catch((err) => {
                        message.channel.send('There was an error comparing your loadorder, contact Robotic');
                        logMessage('Error: Failed to compare loadorder in ' + getChannelStr(message.channel) + '\nURL: ' + url + '\n' + err);
                        console.log(err);
                    });
                });
            });
        }).catch(() => {
            message.channel.send('Master loadorder file does not exist');
            return;
        });
        return;
    }
    args = args.slice(1, args.length);

    if (args[0] === 'channel') {
        if (!isStaff(message.guild, message.author.id)) {
            return;
        }
        if (args.length === 1) {
            message.channel.send('Subcommands of `' + prefix + 'loadorder channel`:\n' +
                '`' + prefix + 'loadorder channel add` - Adds this channel to list of approved channels\n' +
                '`' + prefix + 'loadorder channel remove` - Removes this channel from list of approved channels\n' +
                '`' + prefix + 'loadorder channel status` - Says if channel is currently approved or not\n' +
                '`' + prefix + 'loadorder channel list` - Lists approved channels');
            return;
        }

        if (args[1] === 'add') {
            if (isApprovedChannel(message.guild, message.channel.id)) {
                message.channel.send('<#' + message.channel.id + '> is already an approved channel');
                return;
            }

            addApprovedChannel(message.guild, message.channel.id).then(() => {
                message.channel.send('Added <#' + message.channel.id + '> to the list of approved channels');
            }).catch(() => {
                message.channel.send('Failed to add <#' + message.channel.id + '> to the list of approved channels, contact Robotic');
            });

        } else if (args[1] === 'remove') {
            if (!isApprovedChannel(message.guild, message.channel.id)) {
                message.channel.send('<#' + message.channel.id + '> is not an approved channel');
                return;
            }

            removeApprovedChannel(message.guild, message.channel.id).then(() => {
                message.channel.send('Removed <#' + message.channel.id + '> from the list of approved channels');
            }).catch(() => {
                message.channel.send('Failed to remove <#' + message.channel.id + '> from the list of approved channels, contact Robotic');
            });

        } else if (args[1] === 'status') {
            message.channel.send('<#' + message.channel.id + '> is' + (isApprovedChannel(message.guild, message.channel.id) ? '' : ' not') + ' an approved channel');
        } else if (args[1] === 'list') {
            let guildChannels = approvedChannels.get(message.guild.id);

            if (guildChannels.length === 0) {
                message.channel.send('There are no approved channels');
                return;
            }

            let response = 'List of approved channels:\n';

            approvedChannels.get(message.guild.id).forEach((id) => {
                if (id === '') {
                    return;
                }
                response += '<#' + id + '>\n';
            });

            message.channel.send(response);
        } else {
            message.channel.send('Subcommands of `' + prefix + 'loadorder channel`:\n' +
                '`' + prefix + 'loadorder channel add` - Adds this channel to list of approved channels\n' +
                '`' + prefix + 'loadorder channel remove` - Removes this channel from list of approved channels\n' +
                '`' + prefix + 'loadorder channel status` - Says if channel is currently approved or not\n' +
                '`' + prefix + 'loadorder channel list` - Lists approved channels');
        }
    } else if (args[0] === 'staff') {
        if (!isStaff(message.guild, message.author.id)) {
            return;
        }

        if (args.length === 1) {
            message.channel.send('Subcommands of `' + prefix + 'loadorder staff`:\n' +
                '`' + prefix + 'loadorder staff add <user>` - Sets the given user as staff for the server\n' +
                '`' + prefix + 'loadorder staff remove <user>` - Removes staff from the given user for the server\n' +
                '`' + prefix + 'loadorder staff list` - Lists the staff in the server');
            return;
        }

        if (args[1] === 'add') {
            if (message.mentions.members.array().length !== 1) {
                message.channel.send('This command must ping (mention) exactly 1 user, found ' + message.mentions.members.array().length);
                return;
            }
            let user = message.mentions.members.first();

            if (isStaff(message.guild, user.id)) {
                message.channel.send('That user is already staff');
                return;
            }

            addStaff(message.guild, user.id).then(() => {
                message.channel.send('Added ' + user.user.username + ' to the staff list');
            }).catch(() => {
                message.channel.send('Failed to add ' + user.user.username + ' to the staff list, contact Robotic');
            });

        } else if (args[1] === 'remove') {
            if (message.mentions.members.array().length !== 1) {
                message.channel.send('This command must ping (mention) exactly 1 user, found ' + message.mentions.members.array().length);
                return;
            }
            let user = message.mentions.members.first();
            if (user.id === message.guild.ownerID) {
                message.channel.send('That user cannot be removed from staff, they are the server owner');
                return;
            }

            if (user.id === message.author.id) {
                message.channel.send('You cannot remove yourself as staff');
                return;
            }

            if (!isStaff(message.guild, user.id)) {
                message.channel.send('That user is not staff');
                return;
            }

            removeStaff(message.guild, user.id).then(() => {
                message.channel.send('Removed ' + user.user.username + ' from the staff list');
            }).catch(() => {
                message.channel.send('Failed to remove ' + user.user.username + ' from the staff list, contact Robotic');
            });

        } else if (args[1] === 'list') {
            let response = 'List of staff members:\n';

            staffUsers.get(message.guild.id).forEach((id) => {
                let userObj = client.users.cache.get(id);
                response += userObj.username + '#' + userObj.discriminator + ' (' + id + ')\n';
            });

            message.channel.send(response);
        } else {
            message.channel.send('Subcommands of `' + prefix + 'loadorder staff`:\n' +
                '`' + prefix + 'loadorder staff add <user>` - Sets the given user as staff for the server\n' +
                '`' + prefix + 'loadorder staff remove <user>` - Removes staff from the given user for the server\n' +
                '`' + prefix + 'loadorder staff list` - Lists the staff in the server');
        }
    } else if (args[0] === 'file') {
        if (!isStaff(message.guild, message.author.id)) {
            return;
        }

        let guildTypes = settings.get(message.guild.id)._fileTypes;
        let fileTypes = '';
        types.forEach((value, key) => {
            fileTypes += key + ', ';
        });

        guildTypes.forEach((value, key) => {
            if (key === '') {
                return;
            }
            fileTypes += key + ', ';
        });

        fileTypes = fileTypes.substring(0, fileTypes.length - 2);

        if (args.length === 1 || (args[1] !== 'update' && args[1] !== 'archive' && args[1] !== 'retrieve')) {
            message.channel.send('Subcommands of `' + prefix + 'loadorder file`:\n' +
                '`' + prefix + 'loadorder file update [file]` - Updates the specified file\n' +
                '`' + prefix + 'loadorder file archive [file]` - Archives the current specified file (rarely used)\n' +
                '`' + prefix + 'loadorder file retrieve [file]` - Retrieves and sends the specified file in a discord message attachment\n\n' +
                'Possible files:\n' +
                fileTypes);
            return;
        }

        if (args.length === 2) {
            message.channel.send('You must provide a file type. Known files types:\n' + fileTypes);
            return;
        }

        if (!isValidFile(message.guild, args[2])) {
            message.channel.send('Unknown file type: `' + args[2] + '`. Known files types:\n' + fileTypes);
            return;
        }

        if (args[1] === 'update') {
            if (message.attachments.size !== 1) {
                message.channel.send('Message must contain exactly 1 attachment, got ' + message.attachments.size);
                return;
            }
            let attachment = message.attachments.first();
            let url = attachment.url;


            updateFile(message.guild, args[2], url).then(() => {
                message.channel.send('File has been sucessfully updated.');
                logMessage('The ' + args[2] + ' file has been updated in ' + getGuildStr(message.guild));

                if (args[2] === 'loadorder') {
                    settings.get(message.guild.id).enabled = 'true';
                    saveSettings(message.guild).then(() => {
                        message.channel.send('Resumed loadorder validation');
                        logMessage('Loadorder validation was resumed in ' + getGuildStr(message.guild));
                    }).catch((err) => {
                        message.channel.send('Something went wrong trying to resume validation, contact Robotic');
                        logMessage('Error: Failed to resume validation in ' + getGuildStr(message.guild) + '\n' + err);
                        console.log(err);
                    });
                }
            }).catch((err) => {
                if (err instanceof SyntaxError && args[2] === 'reasons') {
                    archiveIfNeeded(message.guild, args[2]).then(() => {
                        message.channel.send('Invalid JSON provided for reasons file, it has been automatically archived. Re-upload with valid JSON');
                    });
                    return;
                }

                message.channel.send('Something went wrong trying to update the file, contact Robotic!');
                logMessage('FATAL: Something broke trying to update ' + args[2] + ' in ' + getGuildStr(message.guild) + '\n' + err);
                console.log(err);
            });
        } else if (args[1] === 'archive') {
            archiveIfNeeded(message.guild, args[2]).then(() => {
                message.channel.send('The ' + args[2] + ' file has been successfully archived.');
                logMessage('The ' + args[2] + ' file has been archived in ' + getGuildStr(message.guild));
            });
        } else if (args[1] === 'retrieve') {
            fs.readFile('./data/' + message.guild.id + '/' + getFileNameFromFileType(message.guild, args[2]), (err, data) => {
                if (err) {
                    message.channel.send('Error: couldn\'t read the ' + args[2] + ' file, contact Robotic');
                    logMessage('Error: Failed to read ' + args[2] + ' file in ' + getGuildStr(message.guild) + '\n' + err);
                    console.log(err);
                } else {
                    let attachment = new Discord.MessageAttachment(data, getFileNameFromFileType(message.guild, args[2]));
                    message.channel.send('Here is the current ' + args[2] + ' file', attachment);
                }
            });
        }
    } else if (args[0] === 'settings') {
        if (!isStaff(message.guild, message.author.id)) {
            return;
        }

        if (args.length === 1) {
            message.channel.send('Subcommands of `' + prefix + 'loadorder settings`:\n' +
                '`' + prefix + 'loadorder settings pause` - Pauses validation\n' +
                '`' + prefix + 'loadorder settings resume` - Resumes validation\n' +
                '`' + prefix + 'loadorder settings path [path]` - Sets the loadorder file path for users');
            return;
        }

        if (args[1] === 'pause') {
            settings.get(message.guild.id).enabled = 'false';
            saveSettings(message.guild).then(() => {
                message.channel.send('Paused loadorder validation');
                logMessage('Loadorder validation was paused in ' + getGuildStr(message.guild));
            }).catch((err) => {
                message.channel.send('Something went wrong trying to pause validation, contact Robotic');
                logMessage('Error: Failed to pause validation in ' + getGuildStr(message.guild) + '\n' + err);
                console.log(err);
            });
        } else if (args[1] === 'resume') {
            settings.get(message.guild.id).enabled = 'true';
            saveSettings(message.guild).then(() => {
                message.channel.send('Resumed loadorder validation');
                logMessage('Loadorder validation was resumed in ' + getGuildStr(message.guild));
            }).catch((err) => {
                message.channel.send('Something went wrong trying to resume validation, contact Robotic');
                logMessage('Error: Failed to resume validation in ' + getGuildStr(message.guild) + '\n' + err);
                console.log(err);
            });
        } else if (args[1] === 'path') {
            if (args.length === 2) {
                message.channel.send('Usage: `' + prefix + 'loadorder settings path [path]`');
                return;
            }

            let newPath = args.slice(2, args.length).join(' ');
            settings.get(message.guild.id).path = newPath;
            saveSettings(message.guild).then(() => {
                message.channel.send('Updated loadorder file path');
                logMessage('Loadorder file path was updated in ' + getGuildStr(message.guild));
            }).catch((err) => {
                message.channel.send('Something went wrong trying to update loadorder file path, contact Robotic');
                logMessage('Error: Failed to update loadorder file path in ' + getGuildStr(message.guild) + '\n' + err);
                console.log(err);
            });
        }
    } else if (args[0] === 'staffhelp') {
        if (isStaff(message.guild, message.author.id)) {
            message.channel.send('Commands available to staff members:\n' +
                '`' + prefix + 'loadorder staff` - Change who is staff\n' +
                '`' + prefix + 'loadorder channel` - Modify what channels the bot can be used in\n' +
                '`' + prefix + 'loadorder file` - Update, archive, and retrieve various files used by the bot\n' +
                '`' + prefix + 'loadorder settings` - Change bot settings\n' +
                'All staff commands can be used in any channel');
        }
    } else {
        if (isApprovedChannel(message.guild, message.channel.id)) {
            let path = settings.get(message.guild.id).path;
            message.channel.send('This bot will validate your loadorder for you\n' +
                'It does this by comparing your load order against a master list\n' +
                'To use it, type `' + prefix + 'loadorder` and upload your load order (in the same message)\n' +
                'Your load order can be found at `' + path + '`\n' +
                'I will respond with a text file containing what you need to change\n' +
                'Some files may have explanations listed as to why you shouldn\'t have them');
        }
    }
});

client.login(token);

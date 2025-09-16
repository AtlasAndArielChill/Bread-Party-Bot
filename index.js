// Import necessary libraries
const {
    Client,
    GatewayIntentBits,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    SlashCommandBuilder
} = require('discord.js');
const express = require('express');

// Create a new Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Set up the web server for Render's health check
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});

// Use the bot token and target channel ID from Replit's secrets
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// This object tracks the number of players for each party embed
const activeParties = {};

// When the bot is ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Create the /duel command
    const duelCommand = new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Creates a team-based duel to find opponents')
        .addStringOption(option =>
            option.setName('duel_type')
            .setDescription('The duel size (e.g., 1v1, 2v2)')
            .setRequired(true)
            .addChoices({
                name: '1v1',
                value: '1v1'
            }, {
                name: '2v2',
                value: '2v2'
            }, {
                name: '3v3',
                value: '3v3'
            })
        )
        .addStringOption(option =>
            option.setName('region')
            .setDescription('The game server region')
            .setRequired(true)
            .addChoices({
                name: 'North America',
                value: 'NA'
            }, {
                name: 'Asia',
                value: 'ASIA'
            }, {
                name: 'Australia',
                value: 'AU'
            }, {
                name: 'Europe',
                value: 'EU'
            })
        )
        .addStringOption(option =>
            option.setName('server_code')
            .setDescription('The private server code from the Roblox link')
            .setRequired(true)
        );

    // Create the /party command
    const partyCommand = new SlashCommandBuilder()
        .setName('party')
        .setDescription('Creates a party to find teammates for your side')
        .addStringOption(option =>
            option.setName('party_type')
            .setDescription('The party size for your team (e.g., 2v2, 3v3)')
            .setRequired(true)
            .addChoices({
                name: '2v2',
                value: '2v2'
            }, {
                name: '3v3',
                value: '3v3'
            }, {
                name: '4v4',
                value: '4v4'
            })
        )
        .addStringOption(option =>
            option.setName('region')
            .setDescription('The game server region')
            .setRequired(true)
            .addChoices({
                name: 'North America',
                value: 'NA'
            }, {
                name: 'Asia',
                value: 'ASIA'
            }, {
                name: 'Australia',
                value: 'AU'
            }, {
                name: 'Europe',
                value: 'EU'
            })
        )
        .addStringOption(option =>
            option.setName('server_code')
            .setDescription('The private server code from the Roblox link')
            .setRequired(true)
        );

    // Register both commands with Discord's API
    await client.application.commands.create(duelCommand);
    await client.application.commands.create(partyCommand);
    console.log('Slash commands registered!');
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const {
        commandName
    } = interaction;

    let type, region, serverCode, playersNeeded, totalPlayersNeeded, title, description;
    const host = interaction.user;

    if (commandName === 'duel') {
        type = interaction.options.getString('duel_type');
        region = interaction.options.getString('region');
        serverCode = interaction.options.getString('server_code');
        playersNeeded = parseInt(type.charAt(0)) * 2 - 1;
        totalPlayersNeeded = parseInt(type.charAt(0)) * 2;
        title = `A new ${type} duel has been created!`;
        description = `A duel has been started by **${host.tag}**! Click the button below to join the game.`;

    } else if (commandName === 'party') {
        type = interaction.options.getString('party_type');
        region = interaction.options.getString('region');
        serverCode = interaction.options.getString('server_code');
        playersNeeded = parseInt(type.charAt(0)) - 1;
        totalPlayersNeeded = parseInt(type.charAt(0));
        title = `A new ${type} party has been created!`;
        description = `A party has been started by **${host.tag}**! Click the button below to join the team.`;
    }

    const partyId = `${host.id}-${Date.now()}`;
    activeParties[partyId] = {
        players: [host.id],
        playersNeeded: playersNeeded,
        type: type,
        region: region,
        host: host.tag,
        serverCode: serverCode,
        totalPlayers: totalPlayersNeeded
    };

    const embed = {
        color: 0x0099ff,
        title: title,
        description: description,
        fields: [{
            name: 'Region',
            value: region,
            inline: true
        }, {
            name: 'Type',
            value: type,
            inline: true
        }, {
            name: 'Players Needed',
            value: `${playersNeeded} more player(s)`,
            inline: true
        }, ],
        timestamp: new Date(),
    };

    const joinButton = new ButtonBuilder()
        .setCustomId(`join_${commandName}_${partyId}`)
        .setLabel(`Join (${activeParties[partyId].players.length}/${totalPlayersNeeded})`)
        .setStyle(ButtonStyle.Success);

    const actionRow = new ActionRowBuilder().addComponents(joinButton);

    const channel = interaction.guild.channels.cache.get(TARGET_CHANNEL_ID);
    if (channel) {
        await channel.send({
            embeds: [embed],
            components: [actionRow]
        });
        interaction.reply({
            content: `${commandName.charAt(0).toUpperCase() + commandName.slice(1)} successfully created!`,
            ephemeral: true
        });
    } else {
        interaction.reply({
            content: 'Target channel not found. Please check your TARGET_CHANNEL_ID secret.',
            ephemeral: true
        });
    }
});

// Handle button interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, commandType, partyId] = interaction.customId.split('_');

    if (action === 'join' && (commandType === 'duel' || commandType === 'party') && activeParties[partyId]) {
        const party = activeParties[partyId];
        const playerId = interaction.user.id;

        // Check if the user has already joined
        if (party.players.includes(playerId)) {
            return interaction.reply({
                content: 'You have already joined this party.',
                ephemeral: true
            });
        }

        // Check if the party is full
        if (party.playersNeeded <= 0) {
            return interaction.reply({
                content: 'This party is already full.',
                ephemeral: true
            });
        }

        party.players.push(playerId);
        party.playersNeeded--;

        const playersInParty = party.players.length;
        const updatedButton = new ButtonBuilder()
            .setCustomId(`join_${commandType}_${partyId}`)
            .setLabel(`Join (${playersInParty}/${party.totalPlayers})`)
            .setStyle(ButtonStyle.Success);

        const updatedRow = new ActionRowBuilder().addComponents(updatedButton);

        const updatedEmbed = {
            color: 0x0099ff,
            title: `A new ${party.type} ${commandType} has been created!`,
            description: `A ${commandType} has been started by **${party.host}**! Click the button below to join.`,
            fields: [{
                name: 'Region',
                value: party.region,
                inline: true
            }, {
                name: 'Type',
                value: party.type,
                inline: true
            }, {
                name: 'Players Needed',
                value: `${party.playersNeeded} more player(s)`,
                inline: true
            }, ],
            timestamp: new Date(),
        };

        // Update the original message
        await interaction.update({
            embeds: [updatedEmbed],
            components: [updatedRow]
        });

        // Notify the user via DM and ephemeral message
        await interaction.followUp({
            content: `You have successfully joined the ${commandType}!`,
            ephemeral: true
        });

        const joinUrl = `https://www.roblox.com/share?code=${party.serverCode}&type=Server`;
        await interaction.user.send(`Here's your private server link for the **${party.type}** ${commandType} hosted by **${party.host}**: ${joinUrl}`);

        // If the party is full, delete the embed and send a final message
        if (party.playersNeeded <= 0) {
            const fullEmbed = {
                color: 0x00ff00,
                title: `${commandType.charAt(0).toUpperCase() + commandType.slice(1)} is Full!`,
                description: `The **${party.type}** ${commandType} hosted by **${party.host}** is now full! Join the game using the link below.`,
                url: joinUrl,
                fields: [{
                    name: 'Region',
                    value: party.region,
                    inline: true
                }, {
                    name: 'Type',
                    value: party.type,
                    inline: true
                }, ],
                timestamp: new Date(),
            };

            await interaction.message.delete();
            await interaction.channel.send({
                embeds: [fullEmbed]
            });
            delete activeParties[partyId];
        }
    }
});

// Login to Discord with your client's token
client.login(DISCORD_TOKEN);

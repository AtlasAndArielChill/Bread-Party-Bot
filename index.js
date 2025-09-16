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

    // Create the slash command
    const partyCommand = new SlashCommandBuilder()
        .setName('party')
        .setDescription('Creates a new party for a game')
        // We no longer need setDefaultMemberPermissions(null) since you're using integrations
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
            option.setName('duel_type')
            .setDescription('The type of duel (e.g., 1v1, 2v2, 3v3)')
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
            option.setName('server_code')
            .setDescription('The private server code from the Roblox link')
            .setRequired(true)
        );

    // Register the command with Discord's API
    await client.application.commands.create(partyCommand);
    console.log('Slash command registered!');
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const {
        commandName
    } = interaction;

    if (commandName === 'party') {
        const region = interaction.options.getString('region');
        const duelType = interaction.options.getString('duel_type');
        const serverCode = interaction.options.getString('server_code');
        const host = interaction.user;

        const playersNeeded = parseInt(duelType.charAt(0)) * 2 - 1;
        const totalPlayersNeeded = parseInt(duelType.charAt(0)) * 2;

        const partyId = `${host.id}-${Date.now()}`;
        activeParties[partyId] = {
            players: [host.id],
            playersNeeded: playersNeeded,
            duelType: duelType,
            region: region,
            host: host.tag,
            serverCode: serverCode
        };

        const embed = {
            color: 0x0099ff,
            title: `A new ${duelType} party has been created!`,
            description: `A party has been started by **${host.tag}**! Click the button below to join the game.`,
            fields: [{
                name: 'Region',
                value: region,
                inline: true
            }, {
                name: 'Duel Type',
                value: duelType,
                inline: true
            }, {
                name: 'Players Needed',
                value: `${playersNeeded} more player(s)`,
                inline: true
            }, ],
            timestamp: new Date(),
        };

        const joinButton = new ButtonBuilder()
            .setCustomId(`join_party_${partyId}`)
            .setLabel(`Join Party (1/${totalPlayersNeeded})`)
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(joinButton);

        const channel = interaction.guild.channels.cache.get(TARGET_CHANNEL_ID);
        if (channel) {
            await channel.send({
                embeds: [embed],
                components: [actionRow]
            });
            interaction.reply({
                content: 'Party successfully created and sent to the channel!',
                ephemeral: true
            });
        } else {
            interaction.reply({
                content: 'Target channel not found. Please ensure the TARGET_CHANNEL_ID secret is correct.',
                ephemeral: true
            });
        }
    }
});

// Handle button interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, partyId] = interaction.customId.split('_').slice(1);

    if (action === 'party' && activeParties[partyId]) {
        const party = activeParties[partyId];
        const playerId = interaction.user.id;
        const playerTag = interaction.user.tag;

        // Check if the user is the host
        if (party.players[0] === playerId) {
            return interaction.reply({
                content: 'You are the party host and have already joined.',
                ephemeral: true
            });
        }

        // Check if the user has already joined
        if (party.players.includes(playerId)) {
            return interaction.reply({
                content: 'You have already joined this party.',
                ephemeral: true
            });
        }

        // Check if the party is already full
        if (party.playersNeeded <= 0) {
            return interaction.reply({
                content: 'This party is already full.',
                ephemeral: true
            });
        }

        party.players.push(playerId);
        party.playersNeeded--;

        const playersInParty = party.players.length;
        const totalPlayersNeeded = parseInt(party.duelType.charAt(0)) * 2;

        const updatedButton = new ButtonBuilder()
            .setCustomId(`join_party_${partyId}`)
            .setLabel(`Join Party (${playersInParty}/${totalPlayersNeeded})`)
            .setStyle(ButtonStyle.Success);

        const updatedRow = new ActionRowBuilder().addComponents(updatedButton);

        const updatedEmbed = {
            color: 0x0099ff,
            title: `A new ${party.duelType} party has been created!`,
            description: `A party has been started by **${party.host}**! Click the button below to join the game.`,
            fields: [{
                name: 'Region',
                value: party.region,
                inline: true
            }, {
                name: 'Duel Type',
                value: party.duelType,
                inline: true
            }, {
                name: 'Players Needed',
                value: `${party.playersNeeded} more player(s)`,
                inline: true
            }, ],
            timestamp: new Date(),
        };

        // Update the original message with the new embed and button
        await interaction.update({
            embeds: [updatedEmbed],
            components: [updatedRow]
        });

        // Notify the user they have joined and send them the link
        await interaction.followUp({
            content: `You have successfully joined the party!`,
            ephemeral: true
        });

        const joinUrl = `https://www.roblox.com/share?code=${party.serverCode}&type=Server`;
        await interaction.user.send(`Here's your private server link for the **${party.duelType}** party hosted by **${party.host}**: ${joinUrl}`);

        // Check if the party is full and delete the embed
        if (party.playersNeeded <= 0) {
            const fullEmbed = {
                color: 0x00ff00,
                title: 'Party is Full!',
                description: `The **${party.duelType}** party hosted by **${party.host}** is now full! Join the game using the link below.`,
                url: joinUrl,
                fields: [{
                    name: 'Region',
                    value: party.region,
                    inline: true
                }, {
                    name: 'Duel Type',
                    value: party.duelType,
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

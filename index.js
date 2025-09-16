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

// This object tracks active parties and duels
const activeGames = {}; // Will store both parties and duels

// Helper function to determine total players needed for a game type
function getTotalPlayersForGameType(gameType) {
    const firstChar = parseInt(gameType.charAt(0));
    if (isNaN(firstChar)) return 0; // Should not happen with valid inputs
    return firstChar * 2; // e.g., 2v2 needs 4 players total
}

// --- Slash Command Registration ---
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // --- /duel command ---
    const duelCommand = new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Initiates a duel challenge')
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
            .setRequired(true));

    // --- /party command ---
    const partyCommand = new SlashCommandBuilder()
        .setName('party')
        .setDescription('Forms a party to queue for a game')
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
            option.setName('party_type') // Changed name to avoid confusion with duel_type
            .setDescription('The type of party (e.g., 2v2, 3v3, 4v4)')
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
            option.setName('server_code')
            .setDescription('The private server code from the Roblox link')
            .setRequired(true));

    // Register commands
    await client.application.commands.create(duelCommand);
    await client.application.commands.create(partyCommand);
    console.log('Slash commands registered!');
});

// --- Command Interaction Handler ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const {
        commandName
    } = interaction;

    // --- Handling /duel command ---
    if (commandName === 'duel') {
        const region = interaction.options.getString('region');
        const duelType = interaction.options.getString('duel_type');
        const serverCode = interaction.options.getString('server_code');
        const host = interaction.user;

        const totalPlayersNeeded = getTotalPlayersForGameType(duelType);
        // For duels, the host initiates, and players join.
        // The number of players needed to join is totalPlayersNeeded - 1 (host)
        const playersToJoin = totalPlayersNeeded - 1; 
        
        const gameId = `duel-${host.id}-${Date.now()}`;
        activeGames[gameId] = {
            type: 'duel',
            host: host.tag,
            players: [host.id], // Host is the first player
            playersToJoin: playersToJoin,
            duelType: duelType,
            region: region,
            serverCode: serverCode
        };

        const embed = {
            color: 0x0099ff,
            title: `A new ${duelType} duel challenge!`,
            description: `**${host.tag}** is challenging for a ${duelType} duel. Click the button to join the duel!`,
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
                value: `${playersToJoin} more player(s)`,
                inline: true
            }, ],
            timestamp: new Date(),
        };

        const joinButton = new ButtonBuilder()
            .setCustomId(`join_game_${gameId}`)
            .setLabel(`Join Duel (${activeGames[gameId].players.length}/${totalPlayersNeeded})`)
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(joinButton);

        const channel = interaction.guild.channels.cache.get(TARGET_CHANNEL_ID);
        if (channel) {
            await channel.send({
                embeds: [embed],
                components: [actionRow]
            });
            interaction.reply({
                content: 'Duel challenge initiated!',
                ephemeral: true
            });
        } else {
            interaction.reply({
                content: 'Target channel not found. Please ensure the TARGET_CHANNEL_ID secret is correct.',
                ephemeral: true
            });
        }
    }

    // --- Handling /party command ---
    if (commandName === 'party') {
        const region = interaction.options.getString('region');
        const partyType = interaction.options.getString('party_type'); // Use party_type
        const serverCode = interaction.options.getString('server_code');
        const host = interaction.user;

        const totalPlayersNeeded = getTotalPlayersForGameType(partyType);
        // For parties, host is 1 player, and we need (totalPlayersNeeded - 1) more.
        const playersToJoin = totalPlayersNeeded - 1; 
        
        const gameId = `party-${host.id}-${Date.now()}`;
        activeGames[gameId] = {
            type: 'party',
            host: host.tag,
            players: [host.id], // Host is the first player
            playersToJoin: playersToJoin,
            partyType: partyType,
            region: region,
            serverCode: serverCode
        };

        const embed = {
            color: 0x3498db, // Different color for parties
            title: `A new ${partyType} party formed!`,
            description: `**${host.tag}** is forming a party for a ${partyType} game. Click the button to join the party!`,
            fields: [{
                name: 'Region',
                value: region,
                inline: true
            }, {
                name: 'Party Type',
                value: partyType,
                inline: true
            }, {
                name: 'Players Needed',
                value: `${playersToJoin} more player(s)`,
                inline: true
            }, ],
            timestamp: new Date(),
        };

        const joinButton = new ButtonBuilder()
            .setCustomId(`join_game_${gameId}`)
            .setLabel(`Join Party (${activeGames[gameId].players.length}/${totalPlayersNeeded})`)
            .setStyle(ButtonStyle.Primary); // Different style for party buttons

        const actionRow = new ActionRowBuilder().addComponents(joinButton);

        const channel = interaction.guild.channels.cache.get(TARGET_CHANNEL_ID);
        if (channel) {
            await channel.send({
                embeds: [embed],
                components: [actionRow]
            });
            interaction.reply({
                content: 'Party formed and announced!',
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

// --- Button Interaction Handler ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId.startsWith('join_game_')) {
        const parts = customId.split('_');
        const gameType = parts[1]; // 'duel' or 'party'
        const gameId = parts.slice(2).join('_'); // Reconstruct the game ID

        if (activeGames[gameId]) {
            const game = activeGames[gameId];
            const playerId = interaction.user.id;
            const playerTag = interaction.user.tag;

            // Check if the player is the host (already "joined")
            if (game.players[0] === playerId) {
                return interaction.reply({
                    content: `You are the ${game.type} host and have already joined.`,
                    ephemeral: true
                });
            }

            // Check if the player has already joined
            if (game.players.includes(playerId)) {
                return interaction.reply({
                    content: `You have already joined this ${game.type}.`,
                    ephemeral: true
                });
            }

            // Check if the game/party is already full
            if (game.playersNeeded <= 0) {
                return interaction.reply({
                    content: `This ${game.type} is already full.`,
                    ephemeral: true
                });
            }

            // Add player to the game/party
            game.players.push(playerId);
            game.playersNeeded--;

            const playersInGame = game.players.length;
            const totalPlayersNeeded = getTotalPlayersForGameType(gameType === 'duel' ? game.duelType : game.partyType);

            // Determine button style and label based on game type
            const buttonStyle = game.type === 'duel' ? ButtonStyle.Success : ButtonStyle.Primary;
            const buttonLabel = `Join ${game.type.charAt(0).toUpperCase() + game.type.slice(1)} (${playersInGame}/${totalPlayersNeeded})`;

            const updatedButton = new ButtonBuilder()
                .setCustomId(customId) // Keep the same custom ID
                .setLabel(buttonLabel)
                .setStyle(buttonStyle);

            const updatedRow = new ActionRowBuilder().addComponents(updatedButton);

            // Update embed description and player count field
            const updatedEmbedFields = [{
                name: 'Region',
                value: game.region,
                inline: true
            }, {
                name: game.type === 'duel' ? 'Duel Type' : 'Party Type',
                value: game.type === 'duel' ? game.duelType : game.partyType,
                inline: true
            }, {
                name: 'Players Needed',
                value: `${game.playersNeeded} more player(s)`,
                inline: true
            }, ];

            const updatedEmbed = {
                color: game.type === 'duel' ? 0x0099ff : 0x3498db,
                title: `A new ${game.type === 'duel' ? game.duelType : game.partyType} ${game.type} ${game.type === 'duel' ? 'challenge!' : 'formed!'}`,
                description: `**${game.host}** is initiating a ${game.type === 'duel' ? game.duelType + ' duel' : game.partyType + ' party'}. Click the button to join!`,
                fields: updatedEmbedFields,
                timestamp: new Date(),
            };

            // Update the original message
            await interaction.update({
                embeds: [updatedEmbed],
                components: [updatedRow]
            });

            // Notify the user they have joined and send them the link
            await interaction.followUp({
                content: `You have successfully joined the ${game.type}!`,
                ephemeral: true
            });

            const joinUrl = `https://www.roblox.com/share?code=${game.serverCode}&type=Server`;
            await interaction.user.send(`Here's your ${game.type} link for the ${game.type === 'duel' ? game.duelType : game.partyType} game hosted by ${game.host}: ${joinUrl}`);

            // Check if the game/party is full and delete the embed
            if (game.playersNeeded <= 0) {
                const finalEmbed = {
                    color: game.type === 'duel' ? 0x00ff00 : 0x2ecc71, // Greenish for full
                    title: `✅ ${game.type.charAt(0).toUpperCase() + game.type.slice(1)} is Full!`,
                    description: `The ${game.type === 'duel' ? game.duelType + ' duel' : game.partyType + ' party'} hosted by **${game.host}** is now full! Use the link below to join the game.`,
                    url: joinUrl,
                    fields: [{
                        name: 'Region',
                        value: game.region,
                        inline: true
                    }, {
                        name: game.type === 'duel' ? 'Duel Type' : 'Party Type',
                        value: game.type === 'duel' ? game.duelType : game.partyType,
                        inline: true
                    }, ],
                    timestamp: new Date(),
                };

                await interaction.message.delete(); // Delete the original message
                await interaction.channel.send({
                    embeds: [finalEmbed]
                });
                delete activeGames[gameId]; // Remove from active games
            }
        } else {
            // Handle cases where the game/party ID is no longer valid (e.g., expired)
            await interaction.reply({
                content: `This ${customId.startsWith('join_duel') ? 'duel' : 'party'} is no longer active.`,
                ephemeral: true
            });
        }
    }
});

// Login to Discord with your client's token
client.login(DISCORD_TOKEN);

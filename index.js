// ... (Your existing imports and client setup)

// Use the bot token and other sensitive information from Replit's secrets
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// --- New Code for Render Health Check ---
// Get the port from Render's environment variables, default to 8080 if not available
const PORT = process.env.PORT || 8080; 

// Create a simple HTTP server that responds to health checks
// This is what Render will ping to determine if your service is healthy.
const http = require('http');
const server = http.createServer((req, res) => {
  // Respond with a 200 OK status if the bot is running
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
});

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
// --- End of New Code ---

// When the bot is ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // ... (rest of your bot's ready event logic, including command registration)
    const partyCommand = new SlashCommandBuilder()
        .setName('party')
        .setDescription('Creates a new party for a game')
        .setDefaultMemberPermissions(null) 
        .addStringOption(option =>
            option.setName('region')
            .setDescription('The game server region')
            .setRequired(true)
            .addChoices({ name: 'North America', value: 'NA' }, { name: 'Asia', value: 'ASIA' }, { name: 'Australia', value: 'AU' }, { name: 'Europe', value: 'EU' }))
        .addStringOption(option =>
            option.setName('duel_type')
            .setDescription('The type of duel (e.g., 1v1, 2v2, 3v3)')
            .setRequired(true)
            .addChoices({ name: '1v1', value: '1v1' }, { name: '2v2', value: '2v2' }, { name: '3v3', value: '3v3' }))
        .addStringOption(option =>
            option.setName('server_code')
            .setDescription('The private server code from the Roblox link')
            .setRequired(true));

    // Register the command. If you're testing, consider guild-specific registration for speed.
    // For global registration:
    try {
        await client.application.commands.create(partyCommand);
        console.log('Slash command registered!');
    } catch (error) {
        console.error('Error registering slash command:', error);
    }

    // You can remove the permission setting code if you manage it via Discord Integrations.
    // If you kept it from previous steps:
    /*
    const guilds = await client.guilds.fetch();
    for (const [guildId] of guilds) {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) continue;
        const permissions = ALLOWED_ROLES.map(roleId => ({
            id: roleId,
            type: ApplicationCommandPermissionType.Role,
            permission: true,
        }));
        try {
            await guild.commands.permissions.set({ command: registeredCommand.id, permissions });
            console.log(`Permissions set for /party command in guild: ${guild.name}`);
        } catch (error) {
            console.error(`Failed to set permissions for guild ${guild.name}:`, error);
        }
    }
    */
});

// ... (rest of your bot's code for interactionCreate and login)

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'party') {
        // No need for explicit role checks if using Discord Integrations for permissions
        
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
            fields: [{ name: 'Region', value: region, inline: true }, { name: 'Duel Type', value: duelType, inline: true }, { name: 'Players Needed', value: `${playersNeeded} more player(s)`, inline: true }, ],
            timestamp: new Date(),
        };

        const joinButton = new ButtonBuilder()
            .setCustomId(`join_party_${partyId}`)
            .setLabel(`Join Party (1/${totalPlayersNeeded})`)
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(joinButton);

        const channel = interaction.guild.channels.cache.get(TARGET_CHANNEL_ID);
        if (channel) {
            await channel.send({ embeds: [embed], components: [actionRow] });
            interaction.reply({ content: 'Party successfully created and sent to the channel!', ephemeral: true });
        } else {
            interaction.reply({ content: 'Target channel not found. Please ensure the TARGET_CHANNEL_ID secret is correct.', ephemeral: true });
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

        if (party.players[0] === playerId) {
            return interaction.reply({ content: 'You are the party host and have already joined.', ephemeral: true });
        }
        if (party.players.includes(playerId)) {
            return interaction.reply({ content: 'You have already joined this party.', ephemeral: true });
        }
        if (party.playersNeeded <= 0) {
            return interaction.reply({ content: 'This party is already full.', ephemeral: true });
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
            fields: [{ name: 'Region', value: party.region, inline: true }, { name: 'Duel Type', value: party.duelType, inline: true }, { name: 'Players Needed', value: `${party.playersNeeded} more player(s)`, inline: true }, ],
            timestamp: new Date(),
        };
        
        await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
        await interaction.followUp({ content: `You have successfully joined the party!`, ephemeral: true });

        const joinUrl = `https://www.roblox.com/share?code=${party.serverCode}&type=Server`;
        await interaction.user.send(`Here's your private server link for the **${party.duelType}** party hosted by **${party.host}**: ${joinUrl}`);

        if (party.playersNeeded <= 0) {
            const fullEmbed = {
                color: 0x00ff00,
                title: 'Party is Full!',
                description: `The **${party.duelType}** party hosted by **${party.host}** is now full! Join the game using the link below.`,
                url: joinUrl,
                fields: [{ name: 'Region', value: party.region, inline: true }, { name: 'Duel Type', value: party.duelType, inline: true }, ],
                timestamp: new Date(),
            };

            await interaction.message.delete();
            await interaction.channel.send({ embeds: [fullEmbed] });
            delete activeParties[partyId];
        }
    }
});

// Login to Discord with your client's token
client.login(DISCORD_TOKEN);

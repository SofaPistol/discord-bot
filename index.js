const discord = require('discord.js');
const request = require('request');
const { prefix, discord_token, omdb_key } = require('./config.json');

const client = new discord.Client();

client.once('ready', () => {
	console.log('Ready!');
});

client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	// split user input in command and argument part, multiple arguments are not considered for now
	const pos_sep = message.content.indexOf(' ');
	const cmd = (pos_sep != -1) ? message.content.substr(prefix.length, pos_sep - 1).toLowerCase() : message.content.substr(prefix.length).toLowerCase();
	const arg = (pos_sep != -1) ? message.content.substr(pos_sep + 1) : '';

	// command for imdb lookup
	if (cmd === 'i' || cmd === 'imdb') {
		if (!arg.length) return message.channel.send('no argument provided').catch(console.error);

		// search engine is used to get the imdb id, more reliable than querying the search term directly to omdb
		// prepended '\' in the ddg uri returns only the first result as a redirect
		const ddg_uri = `https://www.duckduckgo.com/?q=\\${arg}+site:www.imdb.com/title/tt`;
  		request(ddg_uri, function(error, response, body) {
			if (error || response.statusCode != 200) return message.channel.send('http error').catch(console.error);

			const matches = body.match(/title%2F(tt\d+)%2F/i);
			if (!matches) return message.channel.send('nothing found').catch(console.error);
			const id = matches[1];

			// omdb request, requires api key
			const omdb_uri = `https://www.omdbapi.com/?apikey=${omdb_key}&i=${id}`;
			request(omdb_uri, function(error, response, body) {
				if (error || response.statusCode != 200) return message.channel.send('http error').catch(console.error);

				const omdb_data = JSON.parse(body);
				if (omdb_data.Response === 'False') return;

				// populate discord's richEmbed object
				const rich_embed = new discord.RichEmbed()
					.setTitle(omdb_data.Title + ' ('+omdb_data.Year+')')
					.setURL(`https://www.imdb.com/title/${id}/`)
					.setColor(0x0c82c8)
					.addField('Genre:', omdb_data.Genre)
					.addField('Director:', omdb_data.Director, true)
					.addField('Writer:', omdb_data.Writer, true)
					.addField('Actors:', omdb_data.Actors)
					.addField('Plot:', omdb_data.Plot);

				if (omdb_data.Poster !== 'N/A') rich_embed.setThumbnail(omdb_data.Poster);

				// omdb json may or may not have any of the three ratings
				let imdb_score = 'N/A', rt_score = 'N/A', meta_score = 'N/A';
				if (omdb_data.Ratings.length) {
					imdb_score = omdb_data.imdbRating + '/10';

					omdb_data.Ratings.forEach(function(item){
						if (item.Source === 'Rotten Tomatoes') rt_score = item.Value;
						else if (item.Source === 'Metacritic') meta_score = item.Value;
					});

					// workaround to add additional spacing to richEmbed field
					rich_embed.addField('Ratings:',
						'IMDb: ' + imdb_score + ' (' + omdb_data.imdbVotes +
						' Votes)\u00A0\u00A0\u00A0\u00A0RT: ' + rt_score +
						'\u00A0\u00A0\u00A0\u00A0Meta: ' + meta_score);
				} else rich_embed.addField('Ratings:', 'N/A');

				// send response to channel
				message.channel.send(rich_embed).catch(console.error);
			});
		});
	}

	// command for listing available bot commands
	else if (cmd === 'h' || cmd === 'help') {
		const rich_embed = new discord.RichEmbed()
			.setTitle('Available Bot Commands')
			.setColor(0x0c82c8)
			.addField(`${prefix}h / ${prefix}help`, 'lists available bot commands')
			.addField(`${prefix}i / ${prefix}imdb ARGUMENT`, 'fetches IMDb entry');
		message.channel.send(rich_embed).catch(console.error);
	}
});

client.login(discord_token);
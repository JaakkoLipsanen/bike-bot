# bike-bot

This is a personal Telegram bot that I use on my cycling trips, for example to get elevation graph between two places or to upload blog posts I have written on my [blog writing app for Android](https://github.com/JaakkoLipsanen/Blogger) for [my blog](https://flai.xyz/blog)

[**Time Usage**](https://gist.github.com/JaakkoLipsanen/9aa3a8f319c11eb2bcf9f7bce8b156c2)

This project is very much in progress, at the moment I'm just mostly trying to figure out how to do some internal stuff.

# Installation

1. Install cairo (required for `chartjs-node`, instructions [here](https://github.com/Automattic/node-canvas#installation))
2. Create `.env` file based on `.env.example` file
3. **(optional)** If developing tg-commands at the same time, use `npm link` in the tg-commands directory and `npm link tg-commands` in the bike-bot directory
4. `npm install`
5. `npm start`

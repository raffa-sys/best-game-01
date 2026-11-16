# Nova Harvest

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/competitions/best-game-01)
[![rank](https://make.fun/badge/best-game-01/raffa-sys/best-game-01/rank.svg)](https://make.fun/competitions/best-game-01)
[![reward](https://make.fun/badge/best-game-01/raffa-sys/best-game-01/reward.svg)](https://make.fun/competitions/best-game-01)

**Nova Harvest** is an original starlight arcade game, built for the
[make.fun "Make the best game" bounty](https://make.fun/competitions/best-game-01).
Pilot a harvester drone through the void: collect golden star shards, blast
void mites, weavers and spitters, charge your Nova meter, and beat the Void Maw
on wave 10 to clear the sector — then keep harvesting in endless mode.

- **Play:** `WASD` / arrows to fly, mouse to aim, click or `Space` to fire,
  `E` for a screen-clearing Nova blast, `P` to pause, `M` to mute, `R` to restart.
- **Rules:** 3 lives, a combo multiplier that grows while you keep scoring,
  power-ups (shield, rapid fire, shard magnet, +1 life), escalating waves, and
  a boss every 5 waves. Shards score and charge Nova; kills score more.
- **Tech:** plain HTML5 canvas + WebAudio, no libraries, no network requests,
  no build step. Open `game/index.html` from any static server and play.
- **Screens:** title, play with HUD (score, best, wave, lives, Nova meter,
  combo, boss health), wave banners, pause, game over and victory — all shown
  in `screenshots/`.

## Layout

- `game/` — the playable game as static files (`index.html` + `src/*.js`)
- `screenshots/` — 4 real renders of the game's own code (title, play, boss, game over)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `serve.ts` — a tiny static server for local play-testing (`node serve.ts`)

## Run it

```sh
node serve.ts        # game/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the entry output
```

## License

MIT — see [LICENSE](LICENSE).

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "./supabase";

const ALL_CATEGORIES = [
  "Countries",
  "Sports",
  "Food",
  "Animals",
  "Celebrities",
  "Mythical Creatures",
  "Fictional Characters",
  "Apps & Games",
  "Body & Health",
  "Tools",
  "Objects",
  "Places",
  "Drinks",
];

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function shuffle(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [copy[i], copy[j]] = [
      copy[j],
      copy[i],
    ];
  }

  return copy;
}

function rollFakeout() {
  const roll = Math.random();

  // 3% double
  if (roll < 0.03) {
    return 2;
  }

  // 20% single
  if (roll < 0.23) {
    return 1;
  }

  return 0;
}

// ============================================================
// OFFLINE REVEAL
// ============================================================

function OfflineDiscussionIntro({
  roundCurrent,
  roundLimit,
  onFinished,
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinished();
    }, 1900);

    return () => {
      clearTimeout(timer);
    };
  }, [onFinished]);

  return (
    <div className="phase-splash">
      <div className="retro-grid" />

      <div className="retro-scanlines" />

      <div className="retro-orb retro-orb-one" />
      <div className="retro-orb retro-orb-two" />

      <div className="phase-splash-content">
        <div className="phase-round-label">
          {roundLimit === 1
            ? "ONE SHOT"
            : `ROUND ${roundCurrent} OF ${roundLimit}`}
        </div>

        <div className="discuss-slam">
          DISCUSS!
        </div>

        <div className="discuss-subtitle">
          WHO'S LYING?
        </div>

        <div className="slam-shadow" />
      </div>
    </div>
  );
}

function OfflineReveal({
  result,
  revealEffects,
  tieCounts,
  onContinue,
  onFinal,
}) {
  const [stageIndex, setStageIndex] =
    useState(0);

  const tie = result.tie;

  const actualRole =
    result.role || "INNOCENT";

  const oppositeRole =
    actualRole === "IMPOSTER"
      ? "INNOCENT"
      : "IMPOSTER";

  const fakeoutCount =
    revealEffects && !tie
      ? result.fakeoutCount
      : 0;

  const stages = useMemo(() => {
    if (!revealEffects) {
      return [
        {
          type: tie
            ? "tie"
            : "role",

          role: actualRole,
        },
      ];
    }

    if (tie) {
      return [
        {
          type: "counting",
          duration: 1400,
        },

        {
          type: "tie",
        },
      ];
    }

    const base = [
      {
        type: "voted",
        duration: 1200,
      },

      {
        type: "was",
        duration: 1400,
      },
    ];

    // Normal
    if (fakeoutCount === 0) {
      return [
        ...base,

        {
          type: "role",
          role: actualRole,
        },
      ];
    }

    // Single fakeout
    if (fakeoutCount === 1) {
      return [
        ...base,

        {
          type: "role",
          role: oppositeRole,
          duration: 1800,
        },

        {
          type: "fakeout",
          text: "GET SENT 🤡",
          duration: 1400,
        },

        {
          type: "role",
          role: actualRole,
        },
      ];
    }

    // Double fakeout
    return [
      ...base,

      {
        type: "role",
        role: actualRole,
        duration: 1700,
      },

      {
        type: "fakeout",
        text: "GET SENT 🤡",
        duration: 1300,
      },

      {
        type: "role",
        role: oppositeRole,
        duration: 1700,
      },

      {
        type: "fakeout",
        text: "DOUBLE SENT 🤡🤡",
        duration: 1500,
      },

      {
        type: "role",
        role: actualRole,
      },
    ];
  }, [
    tie,
    actualRole,
    oppositeRole,
    fakeoutCount,
    revealEffects,
  ]);

  useEffect(() => {
    setStageIndex(0);
  }, [result.revealId]);

  useEffect(() => {
    const stage =
      stages[stageIndex];

    if (!stage?.duration) {
      return;
    }

    const timer = setTimeout(
      () => {
        setStageIndex((current) =>
          Math.min(
            current + 1,
            stages.length - 1
          )
        );
      },
      stage.duration
    );

    return () =>
      clearTimeout(timer);
  }, [stageIndex, stages]);

  const stage =
    stages[stageIndex];

  const finished =
    stageIndex ===
    stages.length - 1;

  let content = null;

  if (stage?.type === "counting") {
    content = (
      <>
        <div className="dramatic-dots">
          •••
        </div>

        <h1>
          COUNTING VOTES...
        </h1>
      </>
    );
  }

  if (stage?.type === "voted") {
    content = (
      <>
        <div className="dramatic-small">
          VOTED OUT
        </div>

        <h1 className="dramatic-player-name reveal-voted-name">
          {result.votedOutName}
        </h1>
      </>
    );
  }

  if (stage?.type === "was") {
    content = (
      <>
        <h1 className="dramatic-player-name reveal-held-name">
          {result.votedOutName}
        </h1>

        <div className="dramatic-was reveal-was-hit">
          WAS...
        </div>
      </>
    );
  }

  if (stage?.type === "fakeout") {
    content = (
      <div className="sike-text">
        {stage.text}
      </div>
    );
  }

  if (stage?.type === "tie") {
    content = (
      <>
        <div className="result-icon">
          🤝
        </div>

        <h1>IT'S A TIE</h1>

        <p className="subtitle">
          Nobody was eliminated.
        </p>
      </>
    );
  }

  if (stage?.type === "role") {
    const imposter =
      stage.role === "IMPOSTER";

    content = (
      <div
        className={`reveal-role-drop-zone ${
          revealEffects
            ? "reveal-role-effects-on"
            : "reveal-role-effects-off"
        } ${
          imposter
            ? "reveal-role-zone-imposter"
            : "reveal-role-zone-innocent"
        }`}
      >
        <div className="reveal-role-stack">
          <div className="result-icon reveal-role-icon">
            {imposter ? "😈" : "😇"}
          </div>

          <div
            className={`dramatic-role ${
              imposter
                ? "dramatic-imposter"
                : "dramatic-innocent"
            }`}
          >
            {stage.role}
          </div>
        </div>

        {revealEffects && (
          <>
            <div
              className="reveal-impact-flash"
              aria-hidden="true"
            />

            <div
              className="reveal-impact-line"
              aria-hidden="true"
            />

            <div
              className="reveal-impact-particles"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="main-panel reveal-main-panel">
        <div className="dramatic-reveal-stage">
          <div
            key={`${result.revealId}-${stageIndex}`}
            className={`reveal-stage-content ${
              stage?.type === "role" &&
              revealEffects
                ? "reveal-stage-content-impact"
                : ""
            }`}
          >
            {content}
          </div>
        </div>

        {finished && (
          <>
            {result.tie && (
              <div className="result-reveal">
                <span>
                  {tieCounts
                    ? "TIE COUNTED"
                    : "TIE IGNORED"}
                </span>

                <strong>
                  {tieCounts
                    ? "ROUND USED"
                    : "NO ROUND USED"}
                </strong>
              </div>
            )}

            {!result.matchOver &&
              !result.tie && (
                <div className="result-reveal">
                  <span>
                    GAME CONTINUES
                  </span>

                  <strong>
                    THE IMPOSTER IS
                    STILL OUT THERE
                  </strong>
                </div>
              )}

            <div className="vote-result-progress">
              <span>
                ROUNDS USED
              </span>

              <strong>
                {result.roundsUsed} /{" "}
                {result.roundLimit}
              </strong>
            </div>

            {result.matchOver ? (
              <button
                className="primary-button"
                onClick={onFinal}
              >
                FINAL RESULTS
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={onContinue}
              >
                {result.tie &&
                !tieCounts
                  ? "VOTE AGAIN"
                  : "CONTINUE"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// OFFLINE GAME
// ============================================================

function OfflineGame({
  onExit,
}) {
  const [phase, setPhase] =
    useState("setup");

  const [players, setPlayers] =
    useState([]);

  const [newName, setNewName] =
    useState("");

  const [error, setError] =
    useState("");

  const [working, setWorking] =
    useState(false);

  const [
    imposterCount,
    setImposterCount,
  ] = useState(1);

  const [
    roundLimit,
    setRoundLimit,
  ] = useState(1);

  const [
    roundsUsed,
    setRoundsUsed,
  ] = useState(0);

  const [
    tieCounts,
    setTieCounts,
  ] = useState(true);

  const [
    hintEnabled,
    setHintEnabled,
  ] = useState(true);

  const [
    revealEffects,
    setRevealEffects,
  ] = useState(true);

  const [
    fakeouts,
    setFakeouts,
  ] = useState(true);

  const [
    categories,
    setCategories,
  ] = useState(
    ALL_CATEGORIES
  );

  const [
    secret,
    setSecret,
  ] = useState(null);

  const [
    revealIndex,
    setRevealIndex,
  ] = useState(0);

  const [
    voterIndex,
    setVoterIndex,
  ] = useState(0);

  const [
    selectedVote,
    setSelectedVote,
  ] = useState(null);

  const [votes, setVotes] =
    useState({});

  const [
    result,
    setResult,
  ] = useState(null);

  const activePlayers =
    useMemo(
      () =>
        players.filter(
          (player) =>
            !player.eliminated
        ),
      [players]
    );

  const maxRounds =
    Math.max(
      1,
      players.length - 2
    );

  const maxImposters =
    Math.max(
      1,
      Math.min(
        3,
        Math.floor(
          (players.length - 1) /
            2
        )
      )
    );

  const minimumNeeded =
    imposterCount * 2 + 1;

  useEffect(() => {
    if (
      roundLimit > maxRounds
    ) {
      setRoundLimit(
        maxRounds
      );
    }
  }, [
    maxRounds,
    roundLimit,
  ]);

  useEffect(() => {
    if (
      imposterCount >
      maxImposters
    ) {
      setImposterCount(
        maxImposters
      );
    }
  }, [
    maxImposters,
    imposterCount,
  ]);

  async function ensureAuth() {
    const {
      data: { session },
    } =
      await supabase.auth.getSession();

    if (session?.user) {
      return;
    }

    const { error } =
      await supabase.auth.signInAnonymously();

    if (error) {
      throw error;
    }
  }

  function addPlayer() {
    const name =
      newName.trim();

    if (!name) {
      return;
    }

    const duplicate =
      players.some(
        (player) =>
          player.name
            .toLowerCase() ===
          name.toLowerCase()
      );

    if (duplicate) {
      setError(
        "Use different names in offline mode."
      );

      return;
    }

    setPlayers((current) => [
      ...current,

      {
        id: makeId(),
        name,
        role: null,
        eliminated: false,
      },
    ]);

    setNewName("");

    setError("");
  }

  function removePlayer(id) {
    setPlayers((current) =>
      current.filter(
        (player) =>
          player.id !== id
      )
    );
  }

  function toggleCategory(
    category
  ) {
    if (
      categories.includes(
        category
      )
    ) {
      if (
        categories.length === 1
      ) {
        return;
      }

      setCategories(
        categories.filter(
          (item) =>
            item !== category
        )
      );
    } else {
      setCategories([
        ...categories,
        category,
      ]);
    }
  }

  async function startGame() {
    if (
      players.length <
      minimumNeeded
    ) {
      setError(
        `Need at least ${minimumNeeded} players for ${imposterCount} imposter${
          imposterCount === 1
            ? ""
            : "s"
        }.`
      );

      return;
    }

    try {
      setWorking(true);

      setError("");

      await ensureAuth();

      const {
        data,
        error:
          wordError,
      } = await supabase.rpc(
        "get_offline_word",
        {
          p_categories:
            categories,
        }
      );

      if (wordError) {
        throw wordError;
      }

      const picked =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!picked) {
        throw new Error(
          "Could not find a word."
        );
      }

      const shuffled =
        shuffle(players);

      const imposterIds =
        new Set(
          shuffled
            .slice(
              0,
              imposterCount
            )
            .map(
              (player) =>
                player.id
            )
        );

      const gamePlayers =
        players.map(
          (player) => ({
            ...player,

            role:
              imposterIds.has(
                player.id
              )
                ? "imposter"
                : "innocent",

            eliminated:
              false,
          })
        );

      setPlayers(
        gamePlayers
      );

      setSecret({
        word:
          picked.word,

        hint:
          picked.hint,

        category:
          picked.category,
      });

      setRoundsUsed(0);

      setVotes({});

      setResult(null);

      setRevealIndex(0);

      setVoterIndex(0);

      setSelectedVote(null);

      setPhase("passRole");
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not start offline game."
      );
    } finally {
      setWorking(false);
    }
  }

  function hideAndPass() {
    if (
      revealIndex + 1 <
      players.length
    ) {
      setRevealIndex(
        revealIndex + 1
      );

      setPhase(
        "passRole"
      );
    } else {
  setPhase(
    "discussionIntro"
  );
}
  }

  function beginVoting() {
    setVotes({});

    setVoterIndex(0);

    setSelectedVote(null);

    setPhase("votePass");
  }

  function submitVote() {
    const voter =
      activePlayers[
        voterIndex
      ];

    if (
      !voter ||
      !selectedVote
    ) {
      return;
    }

    const nextVotes = {
      ...votes,

      [voter.id]:
        selectedVote,
    };

    setVotes(
      nextVotes
    );

    setSelectedVote(
      null
    );

    if (
      voterIndex + 1 <
      activePlayers.length
    ) {
      setVoterIndex(
        voterIndex + 1
      );

      setPhase(
        "votePass"
      );

      return;
    }

    resolveVote(
      nextVotes
    );
  }

  function resolveVote(
    finalVotes
  ) {
    const totals = {};

    Object.values(
      finalVotes
    ).forEach(
      (targetId) => {
        totals[targetId] =
          (totals[targetId] ||
            0) + 1;
      }
    );

    const highest =
      Math.max(
        ...Object.values(
          totals
        )
      );

    const topPlayers =
      Object.entries(
        totals
      )
        .filter(
          ([, total]) =>
            total === highest
        )
        .map(
          ([id]) => id
        );

    const tie =
      topPlayers.length !== 1;

    let nextPlayers =
      [...players];

    let votedOut = null;

    let caught = false;

    let nextRoundsUsed =
      roundsUsed;

    if (tie) {
      if (tieCounts) {
        nextRoundsUsed += 1;
      }
    } else {
      nextRoundsUsed += 1;

      votedOut =
        players.find(
          (player) =>
            player.id ===
            topPlayers[0]
        );

      caught =
        votedOut?.role ===
        "imposter";

      if (
        votedOut &&
        !caught
      ) {
        nextPlayers =
          players.map(
            (player) =>
              player.id ===
              votedOut.id
                ? {
                    ...player,
                    eliminated:
                      true,
                  }
                : player
          );
      }
    }

    const matchOver =
      caught ||
      nextRoundsUsed >=
        roundLimit;

    const fakeoutCount =
      !tie &&
      revealEffects &&
      fakeouts
        ? rollFakeout()
        : 0;

    setPlayers(
      nextPlayers
    );

    setRoundsUsed(
      nextRoundsUsed
    );

    setResult({
      revealId:
        makeId(),

      tie,

      votedOutId:
        votedOut?.id ||
        null,

      votedOutName:
        votedOut?.name ||
        null,

      role:
        votedOut
          ? votedOut.role.toUpperCase()
          : null,

      caught,

      matchOver,

      roundsUsed:
        nextRoundsUsed,

      roundLimit,

      fakeoutCount,
    });

    setPhase("result");
  }

  function continueGame() {
    setVotes({});

    setSelectedVote(null);

    setVoterIndex(0);

    setResult(null);

    setPhase(
      "discussionIntro"
    );
  }

  function resetForSettings() {
    setPlayers(
      players.map(
        (player) => ({
          ...player,

          role: null,

          eliminated:
            false,
        })
      )
    );

    setSecret(null);

    setRoundsUsed(0);

    setVotes({});

    setResult(null);

    setRevealIndex(0);

    setVoterIndex(0);

    setSelectedVote(null);

    setPhase("setup");
  }

  // ============================================================
  // SETUP
  // ============================================================

  if (
    phase === "setup"
  ) {
    return (
      <div className="app">
        <div className="main-panel lobby-panel">
          <div className="room-code">
            PASS THE PHONE
          </div>

          <h1>
            OFFLINE MODE
          </h1>

          <p className="subtitle">
            Add everyone playing
            on this phone.
          </p>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="offline-name-row">
            <input
              value={newName}
              maxLength={24}
              placeholder="Player name"
              onChange={(e) =>
                setNewName(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  addPlayer();
                }
              }}
            />

            <button
              className="secondary-button"
              onClick={addPlayer}
            >
              ADD
            </button>
          </div>

          <div className="offline-player-list">
            {players.map(
              (player) => (
                <div
                  className="player-card"
                  key={
                    player.id
                  }
                >
                  <span className="player-name">
                    {player.name}
                  </span>

                  <button
                    className="offline-remove"
                    onClick={() =>
                      removePlayer(
                        player.id
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>

          <div className="settings-card">
            <div className="setting-block">
              <div className="setting-title">
                IMPOSTERS
              </div>

              <div className="number-control">
                <button
                  className="number-button"
                  disabled={
                    imposterCount <=
                    1
                  }
                  onClick={() =>
                    setImposterCount(
                      imposterCount -
                        1
                    )
                  }
                >
                  −
                </button>

                <div className="number-value">
                  {imposterCount}
                </div>

                <button
                  className="number-button"
                  disabled={
                    imposterCount >=
                    maxImposters
                  }
                  onClick={() =>
                    setImposterCount(
                      imposterCount +
                        1
                    )
                  }
                >
                  +
                </button>
              </div>

              <div className="setting-requirement">
                Requires{" "}
                {minimumNeeded}{" "}
                players
              </div>
            </div>

            <div className="setting-block">
              <div className="setting-title">
                ROUNDS
              </div>

              <div className="number-control">
                <button
                  className="number-button"
                  disabled={
                    roundLimit <= 1
                  }
                  onClick={() =>
                    setRoundLimit(
                      roundLimit - 1
                    )
                  }
                >
                  −
                </button>

                <div className="number-value">
                  {roundLimit === 1
                    ? "ONE SHOT"
                    : roundLimit}
                </div>

                <button
                  className="number-button"
                  disabled={
                    roundLimit >=
                    maxRounds
                  }
                  onClick={() =>
                    setRoundLimit(
                      roundLimit + 1
                    )
                  }
                >
                  +
                </button>
              </div>

              <div className="setting-requirement">
                Maximum:{" "}
                {maxRounds}
              </div>
            </div>

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    TIES COUNT
                  </div>

                  <div className="setting-description">
                    A tie uses one
                    round.
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    tieCounts
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={() =>
                    setTieCounts(
                      !tieCounts
                    )
                  }
                >
                  {tieCounts
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    HINTS
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    hintEnabled
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={() =>
                    setHintEnabled(
                      !hintEnabled
                    )
                  }
                >
                  {hintEnabled
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    DRAMATIC REVEAL
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    revealEffects
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={() => {
                    const next =
                      !revealEffects;

                    setRevealEffects(
                      next
                    );

                    if (!next) {
                      setFakeouts(
                        false
                      );
                    }
                  }}
                >
                  {revealEffects
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    FAKEOUTS
                  </div>

                  <div className="setting-description">
                    GET SENT 🤡
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    fakeouts
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  disabled={
                    !revealEffects
                  }
                  onClick={() =>
                    setFakeouts(
                      !fakeouts
                    )
                  }
                >
                  {fakeouts
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            <div className="setting-block">
              <div className="setting-title">
                CATEGORIES
              </div>

              <div className="offline-category-grid">
                {ALL_CATEGORIES.map(
                  (category) => {
                    const selected =
                      categories.includes(
                        category
                      );

                    return (
                      <button
                        key={
                          category
                        }
                        className={`offline-category-button ${
                          selected
                            ? "offline-category-selected"
                            : ""
                        }`}
                        onClick={() =>
                          toggleCategory(
                            category
                          )
                        }
                      >
                        {selected
                          ? "✓ "
                          : ""}
                        {category}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <button
            className="primary-button"
            disabled={
              working ||
              players.length <
                minimumNeeded
            }
            onClick={
              startGame
            }
          >
            {working
              ? "STARTING..."
              : "START GAME"}
          </button>

          <button
            className="secondary-button"
            onClick={onExit}
          >
            BACK TO ONLINE
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // PASS PHONE BEFORE ROLE
  // ============================================================

  if (
    phase === "passRole"
  ) {
    const player =
      players[
        revealIndex
      ];

    return (
      <div className="app">
        <div className="main-panel">
          <div className="offline-pass-icon">
            📱
          </div>

          <h1>
            PASS THE PHONE TO
          </h1>

          <div className="offline-big-name">
            {player?.name}
          </div>

          <p className="subtitle">
            Nobody else look 👀
          </p>

          <button
            className="primary-button"
            onClick={() =>
              setPhase("role")
            }
          >
            I'M {player?.name}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ROLE
  // ============================================================

  if (
    phase === "role"
  ) {
    const player =
      players[
        revealIndex
      ];

    const imposter =
      player?.role ===
      "imposter";

    const lastPlayer =
      revealIndex ===
      players.length - 1;

    return (
      <div className="app">
        <div className="main-panel">
          <div className="role-category">
            CATEGORY

            <strong>
              {secret?.category}
            </strong>
          </div>

          <div
            className={`role-panel ${
              imposter
                ? "imposter-role"
                : ""
            }`}
          >
            <div className="role-icon">
              {imposter
                ? "😈"
                : "😇"}
            </div>

            <h1>
              {imposter
                ? "YOU'RE THE IMPOSTER"
                : "YOU'RE INNOCENT"}
            </h1>

            {imposter ? (
              <div className="secret-word">
                <span>
                  YOUR HINT
                </span>

                <strong>
                  {hintEnabled
                    ? secret?.hint
                    : "NO HINT"}
                </strong>
              </div>
            ) : (
              <div className="secret-word">
                <span>
                  SECRET WORD
                </span>

                <strong>
                  {secret?.word}
                </strong>
              </div>
            )}
          </div>

          <button
            className="primary-button"
            onClick={
              hideAndPass
            }
          >
            {lastPlayer
              ? "HIDE & START"
              : "HIDE & PASS"}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // DISCUSSION
  // ============================================================

if (
  phase === "discussionIntro"
) {
  return (
    <OfflineDiscussionIntro
      roundCurrent={Math.min(
        roundsUsed + 1,
        roundLimit
      )}
      roundLimit={roundLimit}
      onFinished={() =>
        setPhase("discussion")
      }
    />
  );
}

  if (
    phase === "discussion"
  ) {
    return (
      <div className="app">
        <div className="main-panel">
          <div className="room-code">
            ROUND{" "}
            {Math.min(
              roundsUsed + 1,
              roundLimit
            )}{" "}
            OF {roundLimit}
          </div>

          <div className="role-category">
            CATEGORY

            <strong>
              {secret?.category}
            </strong>
          </div>

          <h1>
            DISCUSSION
          </h1>

          <p className="subtitle">
            Who doesn't know the
            word?
          </p>

          <div className="player-list">
            {players.map(
              (player) => (
                <div
                  key={
                    player.id
                  }
                  className={`player-card ${
                    player.eliminated
                      ? "player-eliminated"
                      : ""
                  }`}
                >
                  <span className="player-name">
                    {player.name}
                  </span>

                  {player.eliminated && (
                    <span className="eliminated-badge">
                      OUT
                    </span>
                  )}
                </div>
              )
            )}
          </div>

          <button
            className="primary-button"
            onClick={
              beginVoting
            }
          >
            START VOTING
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // PASS PHONE BEFORE VOTE
  // ============================================================

  if (
    phase === "votePass"
  ) {
    const voter =
      activePlayers[
        voterIndex
      ];

    return (
      <div className="app">
        <div className="main-panel">
          <div className="offline-pass-icon">
            🗳️
          </div>

          <h1>
            PASS THE PHONE TO
          </h1>

          <div className="offline-big-name">
            {voter?.name}
          </div>

          <p className="subtitle">
            Your vote is secret.
          </p>

          <button
            className="primary-button"
            onClick={() =>
              setPhase("vote")
            }
          >
            I'M {voter?.name}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // VOTE
  // ============================================================

  if (
    phase === "vote"
  ) {
    const voter =
      activePlayers[
        voterIndex
      ];

    const targets =
      activePlayers.filter(
        (player) =>
          player.id !==
          voter?.id
      );

    return (
      <div className="app">
        <div className="main-panel">
          <h1>
            CAST YOUR VOTE
          </h1>

          <p className="subtitle">
            Who is the imposter?
          </p>

          <div className="vote-list">
            {targets.map(
              (player) => (
                <button
                  key={
                    player.id
                  }
                  className={`vote-card ${
                    selectedVote ===
                    player.id
                      ? "vote-card-selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedVote(
                      player.id
                    )
                  }
                >
                  {player.name}
                </button>
              )
            )}
          </div>

          <button
            className="primary-button"
            disabled={
              !selectedVote
            }
            onClick={
              submitVote
            }
          >
            LOCK VOTE
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RESULT
  // ============================================================

  if (
    phase === "result" &&
    result
  ) {
    return (
      <OfflineReveal
        result={result}
        revealEffects={
          revealEffects
        }
        tieCounts={
          tieCounts
        }
        onContinue={
          continueGame
        }
        onFinal={() =>
          setPhase("final")
        }
      />
    );
  }

  // ============================================================
  // FINAL
  // ============================================================

  if (
    phase === "final"
  ) {
    const imposters =
      players.filter(
        (player) =>
          player.role ===
          "imposter"
      );

    return (
      <div className="app">
        <div className="main-panel">
          <div className="result-icon">
            {result?.caught
              ? "🎯"
              : "😈"}
          </div>

          <h1>
            {result?.caught
              ? "IMPOSTER CAUGHT"
              : "IMPOSTER ESCAPED"}
          </h1>

          <div className="result-reveal">
            <span>
              {imposters.length ===
              1
                ? "THE IMPOSTER"
                : "THE IMPOSTERS"}
            </span>

            <strong>
              {imposters
                .map(
                  (player) =>
                    player.name
                )
                .join(", ")}
            </strong>
          </div>

          <div className="result-reveal">
            <span>
              SECRET WORD
            </span>

            <strong>
              {secret?.word}
            </strong>
          </div>

          <div className="vote-result-progress">
            <span>
              ROUNDS USED
            </span>

            <strong>
              {roundsUsed} /{" "}
              {roundLimit}
            </strong>
          </div>

          <button
            className="primary-button"
            onClick={startGame}
            disabled={working}
          >
            NEW GAME
          </button>

          <button
            className="secondary-button"
            onClick={
              resetForSettings
            }
          >
            CHANGE SETTINGS
          </button>

          <button
            className="secondary-button"
            onClick={onExit}
          >
            EXIT OFFLINE MODE
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default OfflineGame;
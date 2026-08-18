import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import OfflineGame from "./OfflineGame";
import { supabase } from "./supabase";
import "./App.css";

const ACTIVE_ROOM_KEY = "imposter_active_room_id";

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

// ============================================================
// DRAMATIC REVEAL COMPONENT
// ============================================================

function DiscussionIntro({
  roundCurrent,
  roundLimit,
}) {
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

function VoteRevealScreen({
  voteResult,
  revealEffectsEnabled,
  roomStatus,
  roundsUsed,
  roundLimit,
  tieCountsAsRound,
  isHost,
  working,
  error,
  onContinue,
  onShowFinalResults,
}) {
  const [stageIndex, setStageIndex] = useState(0);

  const tie = Boolean(voteResult?.tie);

  const isFinal =
    roomStatus === "results" ||
    Boolean(voteResult?.match_over);

  const actualRole = voteResult?.imposter_caught
    ? "IMPOSTER"
    : "INNOCENT";

  const oppositeRole =
    actualRole === "IMPOSTER"
      ? "INNOCENT"
      : "IMPOSTER";

  const fakeoutCount =
    revealEffectsEnabled && !tie
      ? Number(
          voteResult?.reveal_fakeout_count || 0
        )
      : 0;

  const stages = useMemo(() => {
    // Reveal effects OFF:
    // immediately show true result.
    if (!revealEffectsEnabled) {
      return [
        {
          type: tie ? "tie" : "role",
          role: actualRole,
        },
      ];
    }

    // Tie reveal.
    if (tie) {
      return [
        {
          type: "counting",
          duration: 1500,
        },

        {
          type: "tie",
        },
      ];
    }

    const base = [
      {
        type: "voted",
        duration: 1300,
      },

      {
        type: "was",
        duration: 1500,
      },
    ];

    // ========================================================
    // NORMAL REVEAL
    // ========================================================

    if (fakeoutCount === 0) {
      return [
        ...base,

        {
          type: "role",
          role: actualRole,
        },
      ];
    }

    // ========================================================
    // SINGLE FAKEOUT
    //
    // Show wrong answer first.
    // GET SENT.
    // Then real answer.
    // ========================================================

    if (fakeoutCount === 1) {
      return [
        ...base,

        {
          type: "role",
          role: oppositeRole,
          duration: 1900,
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

    // ========================================================
    // DOUBLE FAKEOUT
    //
    // Show truth.
    // GET SENT.
    // Show opposite.
    // DOUBLE SENT.
    // Finish on truth.
    //
    // FINAL SCREEN IS ALWAYS CORRECT.
    // ========================================================

    return [
      ...base,

      {
        type: "role",
        role: actualRole,
        duration: 1800,
      },

      {
        type: "fakeout",
        text: "GET SENT 🤡",
        duration: 1300,
      },

      {
        type: "role",
        role: oppositeRole,
        duration: 1800,
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
    revealEffectsEnabled,
    tie,
    fakeoutCount,
    actualRole,
    oppositeRole,
  ]);

  // Reset animation if a new vote result arrives.

  useEffect(() => {
    setStageIndex(0);
  }, [voteResult?.created_at]);

  // Automatically advance animation stages.

  useEffect(() => {
    const stage = stages[stageIndex];

    if (!stage?.duration) {
      return;
    }

    const timer = setTimeout(() => {
      setStageIndex((current) =>
        Math.min(
          current + 1,
          stages.length - 1
        )
      );
    }, stage.duration);

    return () => {
      clearTimeout(timer);
    };
  }, [stageIndex, stages]);

  const isLastStage =
    stageIndex === stages.length - 1;

  // If game is completely over,
  // wait for reveal to finish and then
  // move to the full game results page.

  useEffect(() => {
    if (!isFinal || !isLastStage) {
      return;
    }

    if (!revealEffectsEnabled) {
      const timer = setTimeout(() => {
        onShowFinalResults();
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }

    const timer = setTimeout(() => {
      onShowFinalResults();
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [
    isFinal,
    isLastStage,
    revealEffectsEnabled,
    onShowFinalResults,
  ]);

  const stage = stages[stageIndex];

  const used =
    voteResult?.rounds_used ?? roundsUsed;

  const limit =
    voteResult?.round_limit ?? roundLimit;

  const remaining = Math.max(
    0,
    limit - used
  );

  let mainContent = null;

  // ============================================================
  // COUNTING
  // ============================================================

  if (stage?.type === "counting") {
    mainContent = (
      <>
        <div className="dramatic-dots">
          •••
        </div>

        <h1 className="dramatic-text">
          COUNTING VOTES...
        </h1>
      </>
    );
  }

  // ============================================================
  // VOTED OUT NAME
  // ============================================================

  if (stage?.type === "voted") {
    mainContent = (
      <>
        <div className="dramatic-small">
          VOTED OUT
        </div>

        <h1 className="dramatic-player-name reveal-voted-name">
          {voteResult?.voted_out_name ||
            "UNKNOWN"}
        </h1>
      </>
    );
  }

  // ============================================================
  // "WAS..."
  // ============================================================

  if (stage?.type === "was") {
    mainContent = (
      <>
        <h1 className="dramatic-player-name reveal-held-name">
          {voteResult?.voted_out_name ||
            "UNKNOWN"}
        </h1>

        <div className="dramatic-was reveal-was-hit">
          WAS...
        </div>
      </>
    );
  }

  // ============================================================
  // GET SENT
  // ============================================================

  if (stage?.type === "fakeout") {
    mainContent = (
      <div className="sike-text">
        {stage.text}
      </div>
    );
  }

  // ============================================================
  // TIE
  // ============================================================

  if (stage?.type === "tie") {
    mainContent = (
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

  // ============================================================
  // ROLE
  // ============================================================

  if (stage?.type === "role") {
    const imposter =
      stage.role === "IMPOSTER";

    mainContent = (
      <div
        className={`reveal-role-drop-zone ${
          revealEffectsEnabled
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

        {revealEffectsEnabled && (
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
            key={`${voteResult?.created_at || "vote"}-${stageIndex}`}
            className={`reveal-stage-content ${
              stage?.type === "role" &&
              revealEffectsEnabled
                ? "reveal-stage-content-impact"
                : ""
            }`}
          >
            {mainContent}
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* ===================================================
            GAME CONTINUES
            =================================================== */}

        {isLastStage && !isFinal && (
          <div className="post-reveal-section">
            {tie ? (
              <div className="result-reveal">
                <span>
                  {tieCountsAsRound
                    ? "TIE COUNTED"
                    : "TIE IGNORED"}
                </span>

                <strong>
                  {tieCountsAsRound
                    ? "ROUND USED"
                    : "NO ROUND USED"}
                </strong>
              </div>
            ) : (
              <div className="result-reveal">
                <span>GAME CONTINUES</span>

                <strong>
                  THE IMPOSTER IS STILL OUT THERE
                </strong>
              </div>
            )}

            <div className="vote-result-progress">
              <span>ROUNDS USED</span>

              <strong>
                {used} / {limit}
              </strong>
            </div>

            <div className="vote-result-progress">
              <span>ROUNDS LEFT</span>

              <strong>{remaining}</strong>
            </div>

            {isHost ? (
              <button
                className="primary-button"
                onClick={onContinue}
                disabled={working}
              >
                {working
                  ? "CONTINUING..."
                  : tie &&
                    !tieCountsAsRound
                  ? "VOTE AGAIN"
                  : "CONTINUE"}
              </button>
            ) : (
              <div className="vote-waiting">
                Waiting for the host to
                continue...
              </div>
            )}
          </div>
        )}

        {/* ===================================================
            GAME OVER AFTER REVEAL
            =================================================== */}

        {isLastStage &&
          isFinal &&
          revealEffectsEnabled && (
            <div className="game-over-after-reveal">
              GAME OVER
            </div>
          )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

function HomeIntro() {
  return (
    <div className="home-intro">
      <div className="home-intro-logo">
        IMPOSTER
      </div>

      <div className="home-intro-impact" />
    </div>
  );
}

function App() {
  const [screen, setScreen] =
    useState("loading");
  
  const [
  homeIntroDone,
  setHomeIntroDone,
] = useState(false);

  const [authUserId, setAuthUserId] =
    useState(null);

  const [playerName, setPlayerName] =
    useState("");

  const [nameInput, setNameInput] =
    useState("");

  const [
    roomCodeInput,
    setRoomCodeInput,
  ] = useState("");

  const [roomId, setRoomId] =
    useState(null);

  const [roomCode, setRoomCode] =
    useState("");

  const [
    hostAuthUserId,
    setHostAuthUserId,
  ] = useState(null);

  const [
    roomStatus,
    setRoomStatus,
  ] = useState("lobby");

  const [
    roundNumber,
    setRoundNumber,
  ] = useState(0);

  const [
    readyCount,
    setReadyCount,
  ] = useState(0);

  const [
    votesCast,
    setVotesCast,
  ] = useState(0);

  const [players, setPlayers] =
    useState([]);

  const [
    roundPlayers,
    setRoundPlayers,
  ] = useState([]);

  const [
    onlineAuthIds,
    setOnlineAuthIds,
  ] = useState([]);

  const [
    presenceReady,
    setPresenceReady,
  ] = useState(false);

  const [secret, setSecret] =
    useState(null);

  const [
    roundResult,
    setRoundResult,
  ] = useState(null);

  const [
    voteResult,
    setVoteResult,
  ] = useState(null);

  const [myReady, setMyReady] =
    useState(false);

  const [
    selectedVote,
    setSelectedVote,
  ] = useState(null);

  const [
    voteSubmitted,
    setVoteSubmitted,
  ] = useState(false);

  useEffect(() => {
  if (
    screen !== "home" ||
    homeIntroDone
  ) {
    return;
  }

  const timer = setTimeout(() => {
    setHomeIntroDone(true);
  }, 1900);

  return () => {
    clearTimeout(timer);
  };
}, [screen, homeIntroDone]);
  // DISCUSSION INTRO TIMER
  useEffect(() => {
    if (screen !== "discuss_intro") {
      return;
    }

    const timer = setTimeout(() => {
      setScreen("discussion");
    }, 1900);

    return () => {
      clearTimeout(timer);
    };
  }, [screen]);

  // ============================================================
  // GAME SETTINGS
  // ============================================================

  const [
    imposterCount,
    setImposterCount,
  ] = useState(1);

  const [
    hintEnabled,
    setHintEnabled,
  ] = useState(true);

  const [
    selectedCategories,
    setSelectedCategories,
  ] = useState(ALL_CATEGORIES);

  const [
    categoryDropdownOpen,
    setCategoryDropdownOpen,
  ] = useState(false);

  // ============================================================
  // ROUND SETTINGS
  // ============================================================

  const [
    roundLimit,
    setRoundLimit,
  ] = useState(1);

  const [
    roundsUsed,
    setRoundsUsed,
  ] = useState(0);

  const [
    tieCountsAsRound,
    setTieCountsAsRound,
  ] = useState(true);

  const [
    eliminatedAuthIds,
    setEliminatedAuthIds,
  ] = useState([]);

  // ============================================================
  // REVEAL SETTINGS
  // ============================================================

  const [
    revealEffectsEnabled,
    setRevealEffectsEnabled,
  ] = useState(true);

  const [
    fakeoutsEnabled,
    setFakeoutsEnabled,
  ] = useState(true);

  // ============================================================

  const [
    settingsSaving,
    setSettingsSaving,
  ] = useState(false);

  const [
    lobbyNotice,
    setLobbyNotice,
  ] = useState(null);

  const [error, setError] =
    useState("");

  const [working, setWorking] =
    useState(false);

  const currentRoundRef =
    useRef(0);
  const currentStatusRef =
    useRef("lobby");

  const categoryMenuRef =
    useRef(null);

  const showFinalResults =
    useCallback(() => {
      setScreen("results");
    }, []);

  useEffect(() => {
    currentRoundRef.current =
      roundNumber;
  }, [roundNumber]);

  // ============================================================
  // CATEGORY CLICK OUTSIDE
  // ============================================================

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(
          event.target
        )
      ) {
        setCategoryDropdownOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ============================================================
  // HELPERS
  // ============================================================

  function rememberRoom(id) {
    localStorage.setItem(
      ACTIVE_ROOM_KEY,
      String(id)
    );
  }

  function forgetRoom() {
    localStorage.removeItem(
      ACTIVE_ROOM_KEY
    );
  }

  function normalizePlayers(list) {
    const seen = new Set();

    return [...list]
      .sort(
        (a, b) =>
          new Date(a.created_at) -
          new Date(b.created_at)
      )
      .filter((player) => {
        if (!player.auth_user_id) {
          return false;
        }

        if (
          seen.has(
            player.auth_user_id
          )
        ) {
          return false;
        }

        seen.add(
          player.auth_user_id
        );

        return true;
      });
  }

  function playerLabel(
    player,
    list = players
  ) {
    if (!player) {
      return "Unknown";
    }

    const normalizedList =
      normalizePlayers(list);

    const sameName =
      normalizedList.filter(
        (p) =>
          (p.name || "")
            .trim()
            .toLowerCase() ===
          (player.name || "")
            .trim()
            .toLowerCase()
      );

    if (sameName.length <= 1) {
      return player.name;
    }

    const index =
      sameName.findIndex(
        (p) =>
          p.auth_user_id ===
          player.auth_user_id
      );

    return `${player.name} #${
      index + 1
    }`;
  }

  function generateRoomCode() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
      code +=
        chars[
          Math.floor(
            Math.random() *
              chars.length
          )
        ];
    }

    return code;
  }

  async function ensureAuth() {
    const {
      data: { session },
    } =
      await supabase.auth.getSession();

    if (session?.user) {
      setAuthUserId(
        session.user.id
      );

      return session.user;
    }

    const {
      data,
      error: authError,
    } =
      await supabase.auth.signInAnonymously();

    if (authError) {
      throw authError;
    }

    setAuthUserId(data.user.id);

    return data.user;
  }

  function minimumPlayersNeeded(
    count = imposterCount
  ) {
    return count * 2 + 1;
  }

  const uniquePlayers =
    normalizePlayers(players);

  const onlinePlayerCount =
    uniquePlayers.filter(
      (player) =>
        onlineAuthIds.includes(
          player.auth_user_id
        )
    ).length;

  const isHost =
    !!authUserId &&
    !!hostAuthUserId &&
    authUserId ===
      hostAuthUserId;

  const minimumNeeded =
    minimumPlayersNeeded();

  // User rule:
  // 1 through n - 2 voting rounds.

  const maxRoundLimit =
    Math.max(
      1,
      onlinePlayerCount - 2
    );

  const roundLimitValid =
    roundLimit >= 1 &&
    roundLimit <= maxRoundLimit;

  const allCategoriesSelected =
    selectedCategories.length ===
    ALL_CATEGORIES.length;

  const currentUserEliminated =
    !!authUserId &&
    eliminatedAuthIds.includes(
      authUserId
    );

  const activeRoundPlayers =
    roundPlayers.filter(
      (player) =>
        !eliminatedAuthIds.includes(
          player.auth_user_id
        )
    );

  // ============================================================
  // DATABASE LOADERS
  // ============================================================

  async function fetchRoom(id) {
    const {
      data,
      error: roomError,
    } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (roomError) {
      throw roomError;
    }

    return data;
  }

  function applyRoomData(room) {
    if (!room) {
      return;
    }

    setRoomId(room.id);

    setRoomCode(
      room.code || ""
    );

    setHostAuthUserId(
      room.host_auth_user_id ||
        room.host_id ||
        null
    );

    const nextStatus =
      room.status || "lobby";

    setRoomStatus(nextStatus);

    currentStatusRef.current =
      nextStatus;

    const nextRound =
      room.round_number || 0;

    setRoundNumber(nextRound);

    currentRoundRef.current =
      nextRound;

    setReadyCount(
      room.ready_count || 0
    );

    setVotesCast(
      room.votes_cast || 0
    );

    setImposterCount(
      room.imposter_count || 1
    );

    setHintEnabled(
      typeof room.hint_enabled ===
        "boolean"
        ? room.hint_enabled
        : true
    );

    if (
      Array.isArray(
        room.selected_categories
      ) &&
      room.selected_categories
        .length > 0
    ) {
      setSelectedCategories(
        room.selected_categories
      );
    } else {
      setSelectedCategories(
        ALL_CATEGORIES
      );
    }

    setRoundLimit(
      room.round_limit || 1
    );

    setRoundsUsed(
      room.rounds_used || 0
    );

    setTieCountsAsRound(
      typeof room.tie_counts_as_round ===
        "boolean"
        ? room.tie_counts_as_round
        : true
    );

    setEliminatedAuthIds(
      Array.isArray(
        room.eliminated_auth_user_ids
      )
        ? room.eliminated_auth_user_ids
        : []
    );

    setRevealEffectsEnabled(
      typeof room.reveal_effects_enabled ===
        "boolean"
        ? room.reveal_effects_enabled
        : true
    );

    setFakeoutsEnabled(
      typeof room.fakeouts_enabled ===
        "boolean"
        ? room.fakeouts_enabled
        : true
    );

    setLobbyNotice(
      room.lobby_notice || null
    );
  }

  async function loadPlayers(
    id = roomId
  ) {
    if (!id) {
      return [];
    }

    const {
      data,
      error: playerError,
    } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", id)
      .order(
        "created_at",
        { ascending: true }
      );

    if (playerError) {
      console.error(
        playerError
      );

      return [];
    }

    const normalized =
      normalizePlayers(
        data || []
      );

    setPlayers(normalized);

    return normalized;
  }

  async function loadRoundPlayers(
    id = roomId,
    round =
      currentRoundRef.current
  ) {
    if (!id || !round) {
      setRoundPlayers([]);

      return [];
    }

    const {
      data,
      error: roundPlayerError,
    } = await supabase
      .from("round_players")
      .select("*")
      .eq("room_id", id)
      .eq(
        "round_number",
        round
      )
      .order(
        "created_at",
        { ascending: true }
      );

    if (roundPlayerError) {
      console.error(
        roundPlayerError
      );

      return [];
    }

    const normalized =
      normalizePlayers(
        data || []
      );

    setRoundPlayers(
      normalized
    );

    return normalized;
  }

  async function loadMySecret(
    id = roomId,
    round =
      currentRoundRef.current
  ) {
    if (
      !id ||
      !round ||
      !authUserId
    ) {
      return null;
    }

    const {
      data,
      error: secretError,
    } = await supabase
      .from("player_secrets")
      .select("*")
      .eq("room_id", id)
      .eq(
        "round_number",
        round
      )
      .eq(
        "auth_user_id",
        authUserId
      )
      .maybeSingle();

    if (secretError) {
      console.error(
        secretError
      );

      return null;
    }

    setSecret(
      data || null
    );

    return data || null;
  }

  async function loadRoundContext(
    id = roomId,
    round =
      currentRoundRef.current
  ) {
    const [
      loadedRoundPlayers,
      loadedSecret,
    ] = await Promise.all([
      loadRoundPlayers(
        id,
        round
      ),

      loadMySecret(
        id,
        round
      ),
    ]);

    return {
      roundPlayers:
        loadedRoundPlayers,

      secret:
        loadedSecret,
    };
  }

  async function loadRoundResult(
    id = roomId,
    round =
      currentRoundRef.current
  ) {
    if (!id || !round) {
      return null;
    }

    const {
      data,
      error: resultError,
    } = await supabase
      .from("round_results")
      .select("*")
      .eq("room_id", id)
      .eq(
        "round_number",
        round
      )
      .maybeSingle();

    if (resultError) {
      console.error(
        resultError
      );

      return null;
    }

    setRoundResult(
      data || null
    );

    return data || null;
  }

  async function loadVoteResult(
    id = roomId,
    round =
      currentRoundRef.current
  ) {
    if (!id || !round) {
      return null;
    }

    const {
      data,
      error: resultError,
    } = await supabase
      .from("vote_results")
      .select("*")
      .eq("room_id", id)
      .eq(
        "round_number",
        round
      )
      .maybeSingle();

    if (resultError) {
      console.error(
        resultError
      );

      return null;
    }

    setVoteResult(
      data || null
    );

    return data || null;
  }

  async function getMyRoomState(
    id
  ) {
    const {
      data,
      error: stateError,
    } = await supabase.rpc(
      "get_my_room_state",
      {
        p_room_id: id,
      }
    );

    if (stateError) {
      throw stateError;
    }

    return data;
  }

  async function findExistingMembership(
    room,
    user
  ) {
    const {
      data,
      error: membershipError,
    } = await supabase
      .from("players")
      .select("*")
      .eq(
        "room_id",
        room.id
      )
      .eq(
        "auth_user_id",
        user.id
      )
      .order(
        "created_at",
        { ascending: true }
      )
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    return data;
  }

  // ============================================================
  // SESSION RECOVERY
  // ============================================================

  useEffect(() => {
    recoverActiveRoom();
  }, []);

  async function recoverActiveRoom() {
    try {
      setError("");

      const user =
        await ensureAuth();

      const savedRoomId =
        localStorage.getItem(
          ACTIVE_ROOM_KEY
        );

      if (!savedRoomId) {
        setScreen("home");
        return;
      }

      const savedId =
        Number(savedRoomId);

      if (!savedId) {
        forgetRoom();

        setScreen("home");

        return;
      }

      const room =
        await fetchRoom(
          savedId
        );

      if (!room) {
        forgetRoom();

        setScreen("home");

        return;
      }

      const membership =
        await findExistingMembership(
          room,
          user
        );

      if (!membership) {
        forgetRoom();

        setScreen("home");

        return;
      }

      await restoreRoomSession(
        room,
        user,
        membership
      );
    } catch (err) {
      console.error(err);

      forgetRoom();

      setError(
        err.message ||
          "Could not restore room."
      );

      setScreen("home");
    }
  }

  async function restoreRoomSession(
    room,
    user,
    membership
  ) {
    setAuthUserId(user.id);

    setPlayerName(
      membership.name
    );

    setRoomId(room.id);

    setRoomCode(
      room.code
    );

    rememberRoom(
      room.id
    );

    applyRoomData(room);

    await loadPlayers(
      room.id
    );

    try {
      await supabase.rpc(
        "reconcile_room",
        {
          p_room_id:
            room.id,
        }
      );
    } catch (err) {
      console.error(
        "Initial reconcile failed:",
        err
      );
    }

    const freshRoom =
      await fetchRoom(
        room.id
      );

    if (!freshRoom) {
      forgetRoom();

      setScreen("home");

      return;
    }

    applyRoomData(
      freshRoom
    );

    const myState =
      await getMyRoomState(
        room.id
      );

    setMyReady(
      Boolean(
        myState?.ready
      )
    );

    setVoteSubmitted(
      Boolean(
        myState?.has_voted
      )
    );

    setSelectedVote(null);

    const status =
      freshRoom.status ||
      "lobby";

    const round =
      freshRoom.round_number ||
      0;

    if (status === "lobby") {
      setSecret(null);

      setRoundResult(null);

      setVoteResult(null);

      setRoundPlayers([]);

      setScreen("room");

      return;
    }

    if (
      [
        "playing",
        "discussion",
        "voting",
        "vote_result",
      ].includes(status) &&
      !myState?.in_round
    ) {
      setScreen("waiting");

      return;
    }

    if (status === "playing") {
      const context =
        await loadRoundContext(
          room.id,
          round
        );

      if (!context.secret) {
        setScreen("waiting");

        return;
      }

      setScreen("role");

      return;
    }

    if (
      status === "discussion"
    ) {
      await loadRoundContext(
        room.id,
        round
      );

      setScreen(
        "discussion"
      );

      return;
    }

    if (status === "voting") {
      await loadRoundContext(
        room.id,
        round
      );

      setScreen("voting");

      return;
    }

    if (
      status === "vote_result"
    ) {
      await loadRoundPlayers(
        room.id,
        round
      );

      await loadVoteResult(
        room.id,
        round
      );

      setScreen("reveal");

      return;
    }

    if (status === "results") {
      await loadRoundPlayers(
        room.id,
        round
      );

      await Promise.all([
        loadVoteResult(
          room.id,
          round
        ),

        loadRoundResult(
          room.id,
          round
        ),
      ]);

      setScreen("reveal");

      return;
    }

    setScreen("room");
  }

  // ============================================================
  // REALTIME PLAYERS
  // ============================================================

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const channel =
      supabase
        .channel(
          `players-room-${roomId}`
        )
        .on(
          "postgres_changes",
          {
            event:
              "INSERT",

            schema:
              "public",

            table:
              "players",

            filter:
              `room_id=eq.${roomId}`,
          },
          () => {
            loadPlayers(
              roomId
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [roomId]);

  // ============================================================
  // PRESENCE
  // ============================================================

  useEffect(() => {
    if (
      !roomId ||
      !authUserId
    ) {
      return;
    }

    setPresenceReady(false);

    const presenceChannel =
      supabase.channel(
        `presence-room-${roomId}`,
        {
          config: {
            presence: {
              key:
                authUserId,
            },
          },
        }
      );

    function syncPresence() {
      const state =
        presenceChannel.presenceState();

      setOnlineAuthIds(
        Object.keys(state)
      );

      setPresenceReady(true);
    }

    presenceChannel
      .on(
        "presence",
        { event: "sync" },
        syncPresence
      )
      .on(
        "presence",
        { event: "join" },
        syncPresence
      )
      .on(
        "presence",
        { event: "leave" },
        syncPresence
      )
      .subscribe(
        async (status) => {
          if (
            status ===
            "SUBSCRIBED"
          ) {
            await presenceChannel.track(
              {
                auth_user_id:
                  authUserId,

                name:
                  playerName,

                online_at:
                  new Date().toISOString(),
              }
            );

            syncPresence();
          }
        }
      );

    return () => {
      presenceChannel.untrack();

      supabase.removeChannel(
        presenceChannel
      );

      setOnlineAuthIds([]);

      setPresenceReady(false);
    };
  }, [
    roomId,
    authUserId,
    playerName,
  ]);

  // ============================================================
  // ROOM REALTIME
  // ============================================================

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const roomChannel =
      supabase
        .channel(
          `room-${roomId}`
        )
        .on(
          "postgres_changes",
          {
            event:
              "UPDATE",

            schema:
              "public",

            table:
              "rooms",

            filter:
              `id=eq.${roomId}`,
          },
          async (payload) => {
            const updatedRoom =
              payload.new;

            const previousRound =
              currentRoundRef.current;

            const previousStatus =
              currentStatusRef.current;

            applyRoomData(
              updatedRoom
            );

            const newStatus =
              updatedRoom.status;

            const newRound =
              updatedRoom.round_number ||
              0;

            // ==================================================
            // LOBBY
            // ==================================================

            if (
              newStatus ===
              "lobby"
            ) {
              setMyReady(false);

              setVoteSubmitted(false);

              setSelectedVote(null);

              setSecret(null);

              setRoundResult(null);

              setVoteResult(null);

              setRoundPlayers([]);

              setScreen("room");

              return;
            }

            // ==================================================
            // ROLE
            // ==================================================

            if (
              newStatus ===
              "playing"
            ) {
              if (
                newRound !==
                previousRound
              ) {
                setMyReady(false);

                setVoteSubmitted(
                  false
                );

                setSelectedVote(
                  null
                );

                setRoundResult(
                  null
                );

                setVoteResult(
                  null
                );

                const state =
                  await getMyRoomState(
                    roomId
                  );

                if (
                  !state?.in_round
                ) {
                  setScreen(
                    "waiting"
                  );

                  return;
                }

                const context =
                  await loadRoundContext(
                    roomId,
                    newRound
                  );

                if (
                  !context.secret
                ) {
                  setScreen(
                    "waiting"
                  );

                  return;
                }

                setScreen(
                  "role"
                );
              }

              return;
            }

            // ==================================================
            // DISCUSSION
            // ==================================================

            if (
  newStatus ===
  "discussion"
) {
  const state =
    await getMyRoomState(
      roomId
    );

  if (
    !state?.in_round
  ) {
    setScreen(
      "waiting"
    );

    return;
  }

  setVoteSubmitted(false);
  setSelectedVote(null);

  await loadRoundContext(
    roomId,
    newRound
  );

  // Only play the animation when
  // actually ENTERING discussion.
  // Normal room updates during
  // discussion won't replay it.
  if (
    previousStatus !==
    "discussion"
  ) {
    setScreen(
      "discuss_intro"
    );
  } else {
    setScreen(
      "discussion"
    );
  }

  return;
}

            // ==================================================
            // VOTING
            // ==================================================

            if (
  newStatus ===
  "voting"
) {
  const enteringVoting =
    previousStatus !== "voting";

  const state =
    await getMyRoomState(
      roomId
    );

  if (
    !state?.in_round
  ) {
    setScreen(
      "waiting"
    );

    return;
  }

  await loadRoundPlayers(
    roomId,
    newRound
  );

  setVoteSubmitted(
    Boolean(
      state.has_voted
    )
  );

  // Only clear the selected player
  // when voting FIRST begins.
  // Do not clear it when someone
  // else's vote updates votes_cast.
  if (
    enteringVoting &&
    !state.has_voted
  ) {
    setSelectedVote(
      null
    );
  }

  setScreen(
    "voting"
  );

  return;
}

            // ==================================================
            // INTERMEDIATE RESULT
            // ==================================================

            if (
              newStatus ===
              "vote_result"
            ) {
              await loadRoundPlayers(
                roomId,
                newRound
              );

              await loadVoteResult(
                roomId,
                newRound
              );

              setScreen(
                "reveal"
              );

              return;
            }

            // ==================================================
            // FINAL RESULT
            // ==================================================

            if (
              newStatus ===
              "results"
            ) {
              await loadRoundPlayers(
                roomId,
                newRound
              );

              await Promise.all([
                loadVoteResult(
                  roomId,
                  newRound
                ),

                loadRoundResult(
                  roomId,
                  newRound
                ),
              ]);

              setScreen(
                "reveal"
              );

              return;
            }
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        roomChannel
      );
    };
  }, [roomId]);

  // ============================================================
  // HEARTBEAT
  // ============================================================

  useEffect(() => {
    if (
      !roomId ||
      !authUserId
    ) {
      return;
    }

    let cancelled = false;

    async function reconcile() {
      const {
        error:
          reconcileError,
      } = await supabase.rpc(
        "reconcile_room",
        {
          p_room_id:
            roomId,
        }
      );

      if (
        reconcileError &&
        !cancelled
      ) {
        console.error(
          "Reconcile error:",
          reconcileError
        );
      }
    }

    reconcile();

    const interval =
      setInterval(
        reconcile,
        5000
      );

    return () => {
      cancelled = true;

      clearInterval(
        interval
      );
    };
  }, [
    roomId,
    authUserId,
  ]);

  // ============================================================
  // CREATE ROOM
  // ============================================================

  async function createRoom() {
    const cleanName =
      nameInput.trim();

    if (!cleanName) {
      setError(
        "Enter your name first."
      );

      return;
    }

    try {
      setWorking(true);

      setError("");

      const user =
        await ensureAuth();

      let createdRoom =
        null;

      for (
        let attempt = 0;
        attempt < 10;
        attempt++
      ) {
        const code =
          generateRoomCode();

        const {
          data,
          error: roomError,
        } = await supabase
          .from("rooms")
          .insert({
            code,

            host_id:
              user.id,

            host_auth_user_id:
              user.id,

            status:
              "lobby",

            imposter_count:
              1,

            hint_enabled:
              true,

            selected_categories:
              ALL_CATEGORIES,

            round_limit:
              1,

            tie_counts_as_round:
              true,

            reveal_effects_enabled:
              true,

            fakeouts_enabled:
              true,
          })
          .select()
          .single();

        if (!roomError) {
          createdRoom =
            data;

          break;
        }

        if (
          attempt === 9
        ) {
          throw roomError;
        }
      }

      const {
        data: membership,
        error: playerError,
      } = await supabase
        .from("players")
        .insert({
          room_id:
            createdRoom.id,

          name:
            cleanName,

          player_id:
            user.id,

          auth_user_id:
            user.id,

          ready:
            false,

          last_seen:
            new Date().toISOString(),
        })
        .select()
        .single();

      if (playerError) {
        throw playerError;
      }

      setPlayerName(
        cleanName
      );

      await restoreRoomSession(
        createdRoom,
        user,
        membership
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not create room."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // JOIN ROOM
  // ============================================================

  async function joinRoom() {
    const cleanName =
      nameInput.trim();

    const cleanCode =
      roomCodeInput
        .trim()
        .toUpperCase();

    if (!cleanName) {
      setError(
        "Enter your name first."
      );

      return;
    }

    if (!cleanCode) {
      setError(
        "Enter a room code."
      );

      return;
    }

    try {
      setWorking(true);

      setError("");

      const user =
        await ensureAuth();

      const {
        data: room,
        error: roomError,
      } = await supabase
        .from("rooms")
        .select("*")
        .eq(
          "code",
          cleanCode
        )
        .maybeSingle();

      if (roomError) {
        throw roomError;
      }

      if (!room) {
        setError(
          "Room not found."
        );

        return;
      }

      const existingMembership =
        await findExistingMembership(
          room,
          user
        );

      if (
        existingMembership
      ) {
        await restoreRoomSession(
          room,
          user,
          existingMembership
        );

        return;
      }

      if (
        [
          "playing",
          "discussion",
          "voting",
          "vote_result",
        ].includes(
          room.status
        )
      ) {
        setError(
          "That game is already in progress."
        );

        return;
      }

      const {
        data: membership,
        error: playerError,
      } = await supabase
        .from("players")
        .insert({
          room_id:
            room.id,

          name:
            cleanName,

          player_id:
            user.id,

          auth_user_id:
            user.id,

          ready:
            false,

          last_seen:
            new Date().toISOString(),
        })
        .select()
        .single();

      if (playerError) {
        throw playerError;
      }

      setPlayerName(
        cleanName
      );

      await restoreRoomSession(
        room,
        user,
        membership
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not join room."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // STANDARD SETTINGS
  // ============================================================

  async function saveGameSettings(
    nextImposterCount,
    nextHintEnabled
  ) {
    if (
      !roomId ||
      !isHost ||
      settingsSaving
    ) {
      return;
    }

    try {
      setSettingsSaving(true);

      setError("");

      const {
        error:
          settingsError,
      } = await supabase.rpc(
        "set_game_settings",
        {
          p_room_id:
            roomId,

          p_imposter_count:
            nextImposterCount,

          p_hint_enabled:
            nextHintEnabled,
        }
      );

      if (settingsError) {
        throw settingsError;
      }

      setImposterCount(
        nextImposterCount
      );

      setHintEnabled(
        nextHintEnabled
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not update settings."
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function decreaseImposters() {
    if (
      imposterCount <= 1
    ) {
      return;
    }

    await saveGameSettings(
      imposterCount - 1,
      hintEnabled
    );
  }

  async function increaseImposters() {
    const next =
      imposterCount + 1;

    if (next > 3) {
      return;
    }

    if (
      onlinePlayerCount <
      minimumPlayersNeeded(
        next
      )
    ) {
      return;
    }

    await saveGameSettings(
      next,
      hintEnabled
    );
  }

  async function toggleHints() {
    await saveGameSettings(
      imposterCount,
      !hintEnabled
    );
  }

  // ============================================================
  // ROUND SETTINGS
  // ============================================================

  async function saveRoundSettings(
    nextRoundLimit,
    nextTieCounts
  ) {
    if (
      !roomId ||
      !isHost ||
      settingsSaving
    ) {
      return;
    }

    try {
      setSettingsSaving(true);

      setError("");

      const {
        error:
          roundError,
      } = await supabase.rpc(
        "set_round_settings",
        {
          p_room_id:
            roomId,

          p_round_limit:
            nextRoundLimit,

          p_tie_counts_as_round:
            nextTieCounts,
        }
      );

      if (roundError) {
        throw roundError;
      }

      setRoundLimit(
        nextRoundLimit
      );

      setTieCountsAsRound(
        nextTieCounts
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not update round settings."
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function decreaseRoundLimit() {
    if (
      roundLimit <= 1
    ) {
      return;
    }

    await saveRoundSettings(
      roundLimit - 1,
      tieCountsAsRound
    );
  }

  async function increaseRoundLimit() {
    if (
      roundLimit >=
      maxRoundLimit
    ) {
      return;
    }

    await saveRoundSettings(
      roundLimit + 1,
      tieCountsAsRound
    );
  }

  async function toggleTieCounts() {
    await saveRoundSettings(
      roundLimit,
      !tieCountsAsRound
    );
  }

  // ============================================================
  // REVEAL SETTINGS
  // ============================================================

  async function saveRevealSettings(
    nextRevealEnabled,
    nextFakeoutsEnabled
  ) {
    if (
      !roomId ||
      !isHost ||
      settingsSaving
    ) {
      return;
    }

    try {
      setSettingsSaving(true);

      setError("");

      const {
        error:
          revealError,
      } = await supabase.rpc(
        "set_reveal_settings",
        {
          p_room_id:
            roomId,

          p_reveal_effects_enabled:
            nextRevealEnabled,

          p_fakeouts_enabled:
            nextFakeoutsEnabled,
        }
      );

      if (revealError) {
        throw revealError;
      }

      setRevealEffectsEnabled(
        nextRevealEnabled
      );

      setFakeoutsEnabled(
        nextRevealEnabled
          ? nextFakeoutsEnabled
          : false
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not update reveal settings."
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function toggleRevealEffects() {
    if (
      revealEffectsEnabled
    ) {
      await saveRevealSettings(
        false,
        false
      );
    } else {
      await saveRevealSettings(
        true,
        true
      );
    }
  }

  async function toggleFakeouts() {
    if (
      !revealEffectsEnabled
    ) {
      return;
    }

    await saveRevealSettings(
      true,
      !fakeoutsEnabled
    );
  }

  // ============================================================
  // CATEGORIES
  // ============================================================

  async function saveCategories(
    nextCategories
  ) {
    if (
      !roomId ||
      !isHost ||
      settingsSaving ||
      nextCategories.length ===
        0
    ) {
      return;
    }

    try {
      setSettingsSaving(true);

      setError("");

      const {
        error:
          categoryError,
      } = await supabase.rpc(
        "set_game_categories",
        {
          p_room_id:
            roomId,

          p_categories:
            nextCategories,
        }
      );

      if (categoryError) {
        throw categoryError;
      }

      setSelectedCategories(
        nextCategories
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not update categories."
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function toggleCategory(
    category
  ) {
    if (
      !isHost ||
      settingsSaving
    ) {
      return;
    }

    if (
      selectedCategories.includes(
        category
      )
    ) {
      if (
        selectedCategories.length ===
        1
      ) {
        setError(
          "At least one category must stay selected."
        );

        return;
      }

      const next =
        selectedCategories.filter(
          (item) =>
            item !== category
        );

      await saveCategories(
        next
      );
    } else {
      const next =
        ALL_CATEGORIES.filter(
          (item) =>
            selectedCategories.includes(
              item
            ) ||
            item === category
        );

      await saveCategories(
        next
      );
    }
  }

  async function selectAllCategories() {
    if (
      allCategoriesSelected
    ) {
      return;
    }

    await saveCategories(
      ALL_CATEGORIES
    );
  }

  // ============================================================
  // START GAME
  // ============================================================

  async function startGame() {
    if (
      !roomId ||
      !isHost
    ) {
      return;
    }

    if (
      onlinePlayerCount <
      minimumNeeded
    ) {
      setError(
        `${imposterCount} imposter${
          imposterCount === 1
            ? ""
            : "s"
        } requires at least ${minimumNeeded} online players.`
      );

      return;
    }

    if (!roundLimitValid) {
      setError(
        `With ${onlinePlayerCount} players, choose between 1 and ${maxRoundLimit} rounds.`
      );

      return;
    }

    try {
      setWorking(true);

      setError("");

      setCategoryDropdownOpen(
        false
      );

      setMyReady(false);

      setSelectedVote(null);

      setVoteSubmitted(false);

      setSecret(null);

      setRoundResult(null);

      setVoteResult(null);

      const {
        error:
          startError,
      } = await supabase.rpc(
        "start_game_verified",
        {
          p_room_id:
            roomId,
        }
      );

      if (startError) {
        throw startError;
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not start game."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // READY
  // ============================================================

  async function setReady() {
    if (
      !roomId ||
      myReady
    ) {
      return;
    }

    try {
      setWorking(true);

      setError("");

      const {
        error:
          readyError,
      } = await supabase.rpc(
        "set_ready",
        {
          p_room_id:
            roomId,

          p_ready:
            true,
        }
      );

      if (readyError) {
        throw readyError;
      }

      setMyReady(true);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not mark ready."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // BEGIN VOTING
  // ============================================================

  async function beginVoting() {
    if (
      !roomId ||
      !isHost
    ) {
      return;
    }

    try {
      setWorking(true);

      setError("");

      setSelectedVote(null);

      setVoteSubmitted(false);

      const {
        error:
          votingError,
      } = await supabase.rpc(
        "begin_voting",
        {
          p_room_id:
            roomId,
        }
      );

      if (votingError) {
        throw votingError;
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not begin voting."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // SUBMIT VOTE
  // ============================================================

  async function submitVote() {
    if (
      !roomId ||
      !selectedVote ||
      voteSubmitted ||
      currentUserEliminated
    ) {
      return;
    }

    try {
      setWorking(true);

      setError("");

      const {
        error:
          voteError,
      } = await supabase.rpc(
        "submit_vote",
        {
          p_room_id:
            roomId,

          p_target_auth_user_id:
            selectedVote,
        }
      );

      if (voteError) {
        throw voteError;
      }

      setVoteSubmitted(true);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not submit vote."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // CONTINUE AFTER NON-FINAL VOTE
  // ============================================================

  async function continueAfterVote() {
    if (
      !roomId ||
      !isHost
    ) {
      return;
    }

    try {
      setWorking(true);

      setError("");

      const {
        error:
          continueError,
      } = await supabase.rpc(
        "continue_after_vote",
        {
          p_room_id:
            roomId,
        }
      );

      if (continueError) {
        throw continueError;
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Could not continue game."
      );
    } finally {
      setWorking(false);
    }
  }

  // ============================================================
  // LEAVE ROOM
  // ============================================================

  function leaveRoom() {
    forgetRoom();

    setRoomId(null);

    setRoomCode("");

    setHostAuthUserId(null);

    setRoomStatus("lobby");

    setRoundNumber(0);

    setReadyCount(0);

    setVotesCast(0);

    currentRoundRef.current =
      0;

    setPlayers([]);

    setRoundPlayers([]);

    setOnlineAuthIds([]);

    setSecret(null);

    setRoundResult(null);

    setVoteResult(null);

    setMyReady(false);

    setSelectedVote(null);

    setVoteSubmitted(false);

    setRoundsUsed(0);

    setEliminatedAuthIds([]);

    setSelectedCategories(
      ALL_CATEGORIES
    );

    setCategoryDropdownOpen(
      false
    );

    setLobbyNotice(null);

    setError("");

    setScreen("home");
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  function ErrorMessage() {
    if (!error) {
      return null;
    }

    return (
      <div className="error-message">
        {error}
      </div>
    );
  }

  function PlayerList({
    list = uniquePlayers,
  }) {
    return (
      <div className="player-list">
        {list.map(
          (player) => {
            const online =
              onlineAuthIds.includes(
                player.auth_user_id
              );

            const playerIsHost =
              player.auth_user_id ===
              hostAuthUserId;

            const playerIsYou =
              player.auth_user_id ===
              authUserId;

            const eliminated =
              eliminatedAuthIds.includes(
                player.auth_user_id
              );

            return (
              <div
                className={`player-card ${
                  online
                    ? ""
                    : "player-offline"
                } ${
                  eliminated
                    ? "player-eliminated"
                    : ""
                }`}
                key={
                  player.auth_user_id
                }
              >
                <span className="player-name">
                  {playerLabel(
                    player,
                    list
                  )}
                </span>

                <div className="player-badges">
                  {playerIsHost && (
                    <span className="host-badge">
                      HOST
                    </span>
                  )}

                  {playerIsYou && (
                    <span className="you-badge">
                      YOU
                    </span>
                  )}

                  {eliminated && (
                    <span className="eliminated-badge">
                      OUT
                    </span>
                  )}

                  {online ? (
                    <span className="online-badge">
                      🟢 ONLINE
                    </span>
                  ) : (
                    <span className="offline-badge">
                      ⚫ OFFLINE
                    </span>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (
    screen === "loading"
  ) {
    return (
      <div className="app">
        <div className="main-panel">
          <h1>IMPOSTER</h1>

          <p>
            RESTORING SESSION...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // HOME
  // ============================================================
if (screen === "offline") {
  return (
    <OfflineGame
      onExit={() =>
        setScreen("home")
      }
    />
  );
}

if (
  screen === "home" &&
  !homeIntroDone
) {
  return <HomeIntro />;
}

  if (
    screen === "home"
  ) {
    return (
      <div className="app">
        <div className="main-panel">
          <h1 className="game-title">
            IMPOSTER
          </h1>

          <p className="subtitle">
            Find the imposter.
            Protect the word.
          </p>

          <ErrorMessage />

          <div className="home-section">
            <label>
              Your Name
            </label>

            <input
              type="text"
              value={nameInput}
              maxLength={24}
              placeholder="Enter your name"
              onChange={(e) =>
                setNameInput(
                  e.target.value
                )
              }
            />
          </div>

          <button
            className="primary-button"
            onClick={createRoom}
            disabled={working}
          >
            {working
              ? "CREATING..."
              : "CREATE ROOM"}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="home-section">
            <label>
              Room Code
            </label>

            <input
              type="text"
              value={
                roomCodeInput
              }
              maxLength={6}
              placeholder="ABC123"
              onChange={(e) =>
                setRoomCodeInput(
                  e.target.value.toUpperCase()
                )
              }
            />
          </div>

          <button
            className="secondary-button"
            onClick={joinRoom}
            disabled={working}
          >
            JOIN ROOM
          </button>
          <div className="divider">
  <span>OR</span>
</div>

<button
  className="secondary-button offline-entry-button"
  onClick={() => {
    setError("");
    setScreen("offline");
  }}
>
  OFFLINE / PASS THE PHONE
</button>
        </div>
      </div>
    );
  }

  // ============================================================
  // WAITING
  // ============================================================

  if (
    screen === "waiting"
  ) {
    return (
      <div className="app">
        <div className="main-panel">
          <h1>
            GAME IN PROGRESS
          </h1>

          <p className="subtitle">
            You weren’t part of
            this game.
          </p>

          <p>
            You’ll join the next
            one.
          </p>

          <div className="room-code">
            ROOM {roomCode}
          </div>

          <button
            className="secondary-button"
            onClick={leaveRoom}
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOBBY
  // ============================================================

  if (
    screen === "room"
  ) {
    const plusDisabled =
      settingsSaving ||
      imposterCount >= 3 ||
      onlinePlayerCount <
        minimumPlayersNeeded(
          imposterCount + 1
        );

    const startDisabled =
      !isHost ||
      working ||
      !presenceReady ||
      onlinePlayerCount <
        minimumNeeded ||
      !roundLimitValid;

    return (
      <div className="app">
        <div className="main-panel lobby-panel">
          <div className="lobby-heading-row">
            <div>
              <h1>
                ROOM {roomCode}
              </h1>

              <p className="subtitle">
                Share this code
                with your friends
              </p>
            </div>

            <div className="online-count">
              {onlinePlayerCount}{" "}
              ONLINE
            </div>
          </div>

          {lobbyNotice && (
            <div className="lobby-notice">
              {lobbyNotice}
            </div>
          )}

          <ErrorMessage />

          <h2>PLAYERS</h2>

          <PlayerList />

          <div className="settings-card">
            <div className="settings-header">
              <div>
                <h2>
                  GAME SETTINGS
                </h2>

                {!isHost && (
                  <div className="settings-host-only">
                    Only the host
                    can change
                    settings.
                  </div>
                )}
              </div>
            </div>

            {/* =================================================
                IMPOSTERS
                ================================================= */}

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    IMPOSTERS
                  </div>

                  <div className="setting-description">
                    More imposters
                    require more
                    players.
                  </div>
                </div>

                <div className="setting-value">
                  {imposterCount}
                </div>
              </div>

              <div className="number-control">
                <button
                  className="number-button"
                  onClick={
                    decreaseImposters
                  }
                  disabled={
                    !isHost ||
                    settingsSaving ||
                    imposterCount <=
                      1
                  }
                >
                  −
                </button>

                <div className="number-value">
                  {imposterCount}
                </div>

                <button
                  className="number-button"
                  onClick={
                    increaseImposters
                  }
                  disabled={
                    !isHost ||
                    plusDisabled
                  }
                >
                  +
                </button>
              </div>

              <div className="setting-requirement">
                Requires at least{" "}
                {minimumNeeded}{" "}
                players
              </div>
            </div>

            {/* =================================================
                ROUNDS
                ================================================= */}

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    ROUNDS
                  </div>

                  <div className="setting-description">
                    Number of voting
                    chances before
                    the game ends.
                  </div>
                </div>

                <div className="setting-value">
                  {roundLimit === 1
                    ? "ONE SHOT"
                    : `${roundLimit} ROUNDS`}
                </div>
              </div>

              <div className="number-control">
                <button
                  className="number-button"
                  onClick={
                    decreaseRoundLimit
                  }
                  disabled={
                    !isHost ||
                    settingsSaving ||
                    roundLimit <= 1
                  }
                >
                  −
                </button>

                <div className="number-value">
                  {roundLimit}
                </div>

                <button
                  className="number-button"
                  onClick={
                    increaseRoundLimit
                  }
                  disabled={
                    !isHost ||
                    settingsSaving ||
                    roundLimit >=
                      maxRoundLimit
                  }
                >
                  +
                </button>
              </div>

              <div className="setting-requirement">
                Maximum with{" "}
                {onlinePlayerCount}{" "}
                players:{" "}
                {maxRoundLimit}
              </div>

              {!roundLimitValid && (
                <div className="round-setting-warning">
                  Reduce rounds to{" "}
                  {maxRoundLimit}{" "}
                  before starting.
                </div>
              )}
            </div>

            {/* =================================================
                TIES
                ================================================= */}

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    TIES COUNT
                  </div>

                  <div className="setting-description">
                    If ON, a tied
                    vote uses one
                    round.
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    tieCountsAsRound
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={
                    toggleTieCounts
                  }
                  disabled={
                    !isHost ||
                    settingsSaving
                  }
                >
                  {tieCountsAsRound
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            {/* =================================================
                DRAMATIC REVEAL
                ================================================= */}

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    DRAMATIC REVEAL
                  </div>

                  <div className="setting-description">
                    Animate the
                    result after
                    every vote.
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    revealEffectsEnabled
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={
                    toggleRevealEffects
                  }
                  disabled={
                    !isHost ||
                    settingsSaving
                  }
                >
                  {revealEffectsEnabled
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            {/* =================================================
                FAKEOUTS
                ================================================= */}

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    FAKEOUTS
                  </div>

                  <div className="setting-description">
                    Occasionally
                    lies before
                    revealing the
                    real role 🤡
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    fakeoutsEnabled
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={
                    toggleFakeouts
                  }
                  disabled={
                    !isHost ||
                    settingsSaving ||
                    !revealEffectsEnabled
                  }
                >
                  {fakeoutsEnabled
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            {/* =================================================
                HINTS
                ================================================= */}

            <div className="setting-block">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    HINTS
                  </div>

                  <div className="setting-description">
                    Give the
                    imposter a clue
                    about the
                    secret word.
                  </div>
                </div>

                <button
                  className={`hint-toggle ${
                    hintEnabled
                      ? "hint-toggle-on"
                      : ""
                  }`}
                  onClick={
                    toggleHints
                  }
                  disabled={
                    !isHost ||
                    settingsSaving
                  }
                >
                  {hintEnabled
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </div>

            {/* =================================================
                CATEGORIES
                ================================================= */}

            <div className="setting-block category-setting">
              <div className="setting-label-row">
                <div>
                  <div className="setting-title">
                    CATEGORIES
                  </div>

                  <div className="setting-description">
                    Choose which
                    word categories
                    can appear.
                  </div>
                </div>

                <div className="setting-value">
                  {
                    selectedCategories.length
                  }
                  /
                  {
                    ALL_CATEGORIES.length
                  }
                </div>
              </div>

              <div
                className="category-picker"
                ref={
                  categoryMenuRef
                }
              >
                <button
                  className="category-trigger"
                  type="button"
                  disabled={
                    !isHost ||
                    settingsSaving
                  }
                  onClick={() =>
                    setCategoryDropdownOpen(
                      (open) =>
                        !open
                    )
                  }
                >
                  <span>
                    {allCategoriesSelected
                      ? "ALL CATEGORIES"
                      : `${selectedCategories.length} SELECTED`}
                  </span>

                  <span
                    className={`category-arrow ${
                      categoryDropdownOpen
                        ? "category-arrow-open"
                        : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {categoryDropdownOpen &&
                  isHost && (
                    <div className="category-dropdown">
                      <button
                        type="button"
                        className="category-option category-select-all"
                        onClick={
                          selectAllCategories
                        }
                      >
                        <span
                          className={`category-checkbox ${
                            allCategoriesSelected
                              ? "category-checkbox-selected"
                              : ""
                          }`}
                        >
                          {allCategoriesSelected
                            ? "✓"
                            : ""}
                        </span>

                        <span>
                          SELECT ALL
                        </span>
                      </button>

                      <div className="category-divider" />

                      {ALL_CATEGORIES.map(
                        (
                          category
                        ) => {
                          const selected =
                            selectedCategories.includes(
                              category
                            );

                          return (
                            <button
                              key={
                                category
                              }
                              type="button"
                              className={`category-option ${
                                selected
                                  ? "category-option-selected"
                                  : ""
                              }`}
                              onClick={() =>
                                toggleCategory(
                                  category
                                )
                              }
                            >
                              <span
                                className={`category-checkbox ${
                                  selected
                                    ? "category-checkbox-selected"
                                    : ""
                                }`}
                              >
                                {selected
                                  ? "✓"
                                  : ""}
                              </span>

                              <span>
                                {
                                  category
                                }
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>

          {isHost ? (
            <>
              {onlinePlayerCount <
                minimumNeeded && (
                <div className="start-warning">
                  Need{" "}
                  {minimumNeeded}{" "}
                  online players
                  for{" "}
                  {imposterCount}{" "}
                  imposter
                  {imposterCount ===
                  1
                    ? ""
                    : "s"}
                  .
                </div>
              )}

              <button
                className="primary-button"
                onClick={
                  startGame
                }
                disabled={
                  startDisabled
                }
              >
                {working
                  ? "STARTING..."
                  : "START GAME"}
              </button>
            </>
          ) : (
            <div className="start-warning">
              Waiting for the
              host to start the
              game...
            </div>
          )}

          <button
            className="secondary-button change-settings-button"
            onClick={leaveRoom}
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ROLE
  // ============================================================

  if (
    screen === "role"
  ) {
    const isImposter =
      secret?.role ===
      "imposter";

    return (
      <div className="app">
        <div className="main-panel">
          <div className="room-code">
            GAME{" "}
            {roundNumber}
          </div>

          <div className="role-category">
            CATEGORY
            <strong>
              {secret?.category ||
                "UNKNOWN"}
            </strong>
          </div>

          <div
            className={`role-panel ${
              isImposter
                ? "imposter-role"
                : ""
            }`}
          >
            {isImposter ? (
              <>
                <div className="role-icon">
                  😈
                </div>

                <h1>
                  YOU’RE THE
                  IMPOSTER
                </h1>

                <p>
                  Blend in. Figure
                  out the secret
                  word.
                </p>

                {hintEnabled &&
                secret?.hint ? (
                  <div className="secret-word">
                    <span>
                      YOUR HINT
                    </span>

                    <strong>
                      {
                        secret.hint
                      }
                    </strong>
                  </div>
                ) : (
                  <div className="secret-word">
                    <span>
                      YOUR HINT
                    </span>

                    <strong>
                      NO HINT
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="role-icon">
                  😇
                </div>

                <h1>
                  YOU’RE INNOCENT
                </h1>

                <p>
                  Protect the
                  word. Find the
                  imposter.
                </p>

                <div className="secret-word">
                  <span>
                    SECRET WORD
                  </span>

                  <strong>
                    {secret?.word}
                  </strong>
                </div>
              </>
            )}
          </div>

          <div className="ready-count">
            READY{" "}
            {readyCount}/
            {
              roundPlayers.length
            }
          </div>

          <ErrorMessage />

          <button
            className="primary-button"
            onClick={setReady}
            disabled={
              myReady ||
              working
            }
          >
            {myReady
              ? "READY ✓"
              : "I'M READY"}
          </button>

          {myReady && (
            <p className="subtitle">
              Waiting for everyone
              else...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // DISCUSSION
  // ============================================================

if (
  screen === "discuss_intro"
) {
  return (
    <DiscussionIntro
      roundCurrent={Math.min(
        roundsUsed + 1,
        roundLimit
      )}
      roundLimit={roundLimit}
    />
  );
}

  if (
    screen === "discussion"
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

          <h1>
            DISCUSSION
          </h1>

          <p className="subtitle">
            Talk it out. Who
            doesn’t know the word?
          </p>

          {currentUserEliminated && (
            <div className="spectator-notice">
              YOU'RE OUT —
              SPECTATING
            </div>
          )}

          <PlayerList
            list={roundPlayers}
          />

          <ErrorMessage />

          {isHost ? (
            <button
              className="primary-button"
              onClick={
                beginVoting
              }
              disabled={working}
            >
              {working
                ? "STARTING..."
                : "BEGIN VOTING"}
            </button>
          ) : (
            <div className="vote-waiting">
              Waiting for the
              host to begin
              voting...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // VOTING
  // ============================================================

  if (
    screen === "voting"
  ) {
    const voteTargets =
      activeRoundPlayers.filter(
        (player) =>
          player.auth_user_id !==
          authUserId
      );

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

          <h1>VOTE</h1>

          <p className="subtitle">
            Who do you think is
            the imposter?
          </p>

          <div className="vote-progress">
            VOTES{" "}
            {votesCast}/
            {
              activeRoundPlayers.length
            }
          </div>

          <ErrorMessage />

          {currentUserEliminated ? (
            <div className="spectator-notice">
              <strong>
                YOU'RE OUT
              </strong>

              <br />

              Spectating this
              vote.
            </div>
          ) : (
            <>
              <div className="vote-list">
                {voteTargets.map(
                  (player) => {
                    const selected =
                      selectedVote ===
                      player.auth_user_id;

                    return (
                      <button
                        key={
                          player.auth_user_id
                        }
                        className={`vote-card ${
                          selected
                            ? "vote-card-selected"
                            : ""
                        }`}
                        disabled={
                          voteSubmitted
                        }
                        onClick={() =>
                          setSelectedVote(
                            player.auth_user_id
                          )
                        }
                      >
                        <span>
                          {playerLabel(
                            player,
                            roundPlayers
                          )}
                        </span>

                        {player.auth_user_id ===
                          hostAuthUserId && (
                          <span className="host-badge">
                            HOST
                          </span>
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              {!voteSubmitted ? (
                <button
                  className="primary-button"
                  onClick={
                    submitVote
                  }
                  disabled={
                    !selectedVote ||
                    working
                  }
                >
                  {working
                    ? "SUBMITTING..."
                    : "SUBMIT VOTE"}
                </button>
              ) : (
                <div className="vote-waiting">
                  VOTE LOCKED ✓
                  <br />
                  Waiting for
                  everyone else...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // DRAMATIC REVEAL
  // ============================================================

  if (
    screen === "reveal"
  ) {
    if (!voteResult) {
      return (
        <div className="app">
          <div className="main-panel">
            <h1>
              CALCULATING RESULT...
            </h1>
          </div>
        </div>
      );
    }

    return (
      <VoteRevealScreen
        key={`${roomId}-${roundNumber}-${voteResult.created_at}`}
        voteResult={
          voteResult
        }
        revealEffectsEnabled={
          revealEffectsEnabled
        }
        roomStatus={
          roomStatus
        }
        roundsUsed={
          roundsUsed
        }
        roundLimit={
          roundLimit
        }
        tieCountsAsRound={
          tieCountsAsRound
        }
        isHost={isHost}
        working={working}
        error={error}
        onContinue={
          continueAfterVote
        }
        onShowFinalResults={
          showFinalResults
        }
      />
    );
  }

  // ============================================================
  // FINAL RESULTS
  // ============================================================

  if (
    screen === "results"
  ) {
    const imposterNames =
      roundResult
        ?.imposter_names
        ?.length
        ? roundResult.imposter_names
        : roundResult?.imposter_name
        ? [
            roundResult.imposter_name,
          ]
        : [];

    const caught =
      Boolean(
        roundResult?.imposter_caught
      );

    const finalTie =
      Boolean(
        roundResult?.tie
      );

    const resultTitle =
      caught
        ? "IMPOSTER CAUGHT"
        : "IMPOSTER ESCAPED";

    const resultIcon =
      caught
        ? "🎯"
        : "😈";

    return (
      <div className="app">
        <div className="main-panel">
          <div className="result-panel">
            <div className="result-icon">
              {resultIcon}
            </div>

            <h1>
              {resultTitle}
            </h1>

            {finalTie &&
              !caught && (
                <p className="subtitle">
                  The final vote
                  ended in a tie.
                </p>
              )}

            {!finalTie &&
              roundResult?.voted_out_name && (
                <div className="result-player">
                  <span>
                    FINAL VOTE
                  </span>

                  <div className="result-name">
                    {
                      roundResult.voted_out_name
                    }
                  </div>
                </div>
              )}

            <div className="result-reveal">
              <span>
                {imposterNames.length ===
                1
                  ? "THE IMPOSTER"
                  : "THE IMPOSTERS"}
              </span>

              <strong>
                {imposterNames.length
                  ? imposterNames.join(
                      ", "
                    )
                  : "Unknown"}
              </strong>
            </div>

            <div className="result-reveal">
              <span>
                SECRET WORD
              </span>

              <strong>
                {roundResult?.word ||
                  "Unknown"}
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
          </div>

          <ErrorMessage />

          {isHost ? (
            <>
              {onlinePlayerCount >=
              minimumNeeded ? (
                <button
                  className="primary-button replay-button"
                  onClick={
                    startGame
                  }
                  disabled={
                    working ||
                    !roundLimitValid
                  }
                >
                  {working
                    ? "STARTING..."
                    : "NEW GAME"}
                </button>
              ) : (
                <div className="start-warning">
                  Need{" "}
                  {minimumNeeded}{" "}
                  online players
                  to start another
                  game.
                </div>
              )}

              <button
                className="secondary-button change-settings-button"
                onClick={() =>
                  setScreen(
                    "room"
                  )
                }
              >
                CHANGE SETTINGS
              </button>
            </>
          ) : (
            <div className="vote-waiting">
              Waiting for the
              host...
            </div>
          )}

          <button
            className="secondary-button change-settings-button"
            onClick={leaveRoom}
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
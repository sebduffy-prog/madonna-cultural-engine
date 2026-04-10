import { useState } from "react";

const Y = "#FFD500";
const BG = "#0C0C0C";
const CARD = "#151515";
const BORDER = "#222";
const MUTED = "#777";
const WHITE = "#EDEDE8";
const DIM = "#999";
const GREEN = "#34D399";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const TEAL = "#2DD4BF";
const PURPLE = "#A78BFA";
const CORAL = "#FB923C";
const PINK = "#F472B6";

function Sect({ title, children, accent = Y }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: accent, borderRadius: 2 }} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Insight({ text, color = MUTED }) {
  return <p style={{ fontSize: 14, color, lineHeight: 1.75, margin: "0 0 12px" }}>{text}</p>;
}

function Pull({ text, color = WHITE }) {
  return <p style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.4, margin: "20px 0", letterSpacing: "-0.01em" }}>{text}</p>;
}

function Card({ children, accent }) {
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "20px 24px", border: `1px solid ${BORDER}`, marginBottom: 12, borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      {children}
    </div>
  );
}

function StatRow({ label, value, sub, color = WHITE }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: DIM }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState("insight");
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");

  if (!authed) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: Y }}>VCCPm cultural intelligence</span>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: WHITE, margin: "8px 0 24px", letterSpacing: "-0.02em" }}>Madonna</h1>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && pw === "Tune5") setAuthed(true); }} placeholder="Enter password" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 20px", fontSize: 14, color: WHITE, outline: "none", width: 220, textAlign: "center", fontFamily: "'Inter Tight', system-ui, sans-serif" }} autoFocus />
          <div style={{ marginTop: 12 }}>
            <button onClick={() => { if (pw === "Tune5") setAuthed(true); }} style={{ background: Y, color: BG, border: "none", borderRadius: 8, padding: "10px 32px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Enter</button>
          </div>
          {pw.length > 0 && pw !== "Tune5" && <p style={{ color: RED, fontSize: 12, marginTop: 12 }}>Incorrect password</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'Newsreader', 'Georgia', serif", color: WHITE }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: Y, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>VCCPm cultural intelligence</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: WHITE, lineHeight: 1.1, margin: "0 0 4px", letterSpacing: "-0.02em", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Madonna</h1>
        <p style={{ fontSize: 15, color: MUTED, margin: "0 0 4px", fontStyle: "italic" }}>The original. Not the comeback.</p>
        <div style={{ height: 3, background: Y, borderRadius: 2, margin: "16px 0 24px" }} />

        <div style={{ display: "flex", gap: 6, marginBottom: 32, flexWrap: "wrap" }}>
          {[
            { id: "insight", label: "The insight" },
            { id: "audiences", label: "Who matters and why" },
            { id: "territories", label: "Where to fight" },
            { id: "engine", label: "The reactive engine" },
            { id: "channels", label: "Where attention lives" },
            { id: "britishgas", label: "Social intelligence" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 16px", fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? BG : MUTED, background: tab === t.id ? Y : "transparent",
              border: tab === t.id ? "none" : `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer",
              fontFamily: "'Inter Tight', system-ui, sans-serif", transition: "all 0.15s"
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "insight" && <>
          <Sect title="The human truth">
            <Pull text="The world is busy debating whether Madonna is still relevant. The answer is in every artist they compare her to." />
            <Insight text="This isn't a positioning exercise. It's a tension that already exists inside the audience's head. They know she's the origin. They just haven't said it out loud. The cultural engine doesn't argue the case. It makes the invisible visible." color={DIM} />
            <Insight text="Vanity Fair wrote that Taylor Swift owes the entire concept of having 'eras' to Madonna. Beyonce called her 'Queen Mother' on the Queens Remix and sampled Vogue with her explicit blessing. Beyonce herself said she wanted to 'follow in the footsteps of Madonna and be a powerhouse.' The lineage is there. It's just been buried under appearance discourse and nostalgia cycles." color={DIM} />
          </Sect>

          <Sect title="Why this moment matters" accent={CORAL}>
            <Card accent={CORAL}>
              <Pull text="Madonna is entering the highest-density cultural window she's had in a decade. And none of it is accidental." color={CORAL} />
              <Insight text="A new dance album with Stuart Price (the partnership that produced her most critically adored late-career work). A return to Warner Records, the label where it all began. A Netflix series with Shawn Levy. A Dolce & Gabbana fragrance campaign and front-row presence at two major fashion weeks. The Veronica Electronica remix album resurfacing unreleased Ray of Light material. Hung Up added to Just Dance 2026." color={DIM} />
              <Insight text="These aren't separate events. They're converging vectors. The engine's job is to make sure the narrative around this convergence is 'the original, returning to the floor she built' and not 'ageing icon attempts comeback.'" color={DIM} />
            </Card>
          </Sect>

          <Sect title="What brand heat actually means" accent={PURPLE}>
            <Insight text="Brand heat is not follower count, streaming numbers, or chart position. Madonna will never out-chart Sabrina Carpenter. She doesn't need to. She needs to be the artist Sabrina Carpenter references." color={DIM} />
            <Card accent={PURPLE}>
              <StatRow label="Primary metric" value="Association shift" sub="From 'surgery discourse' to 'original icon'" color={PURPLE} />
              <StatRow label="Measurement" value="Quarterly brand lift" sub="Unprompted: 'what comes to mind when I say Madonna?'" color={PURPLE} />
              <StatRow label="Behavioural signal" value="New cohort streaming" sub="Under-25 listener growth on catalogue + new album" color={TEAL} />
              <StatRow label="Cultural velocity" value="Earned media ratio" sub="Artistry coverage vs appearance coverage" color={CORAL} />
              <StatRow label="Social proof" value="Save + share rate" sub="Not views. Not likes. Saves and shares only." color={GREEN} />
            </Card>
            <Insight text="Platform ROAS overstates true incrementality by 2-10x. Attribution systematically punishes the emotional brand building that Madonna needs most. We measure what matters, not what's easy." color={MUTED} />
          </Sect>

          <Sect title="The strategic tension" accent={AMBER}>
            <Pull text="Madonna's biggest vulnerability is also her biggest asset: she refuses to disappear." />
            <Insight text="The appearance discourse dominates search. It drowns out the music, the fashion, the activism, the influence. But here's the counterintuitive truth: the scrutiny exists because she's still present. Artists who 'age gracefully' by retreating from public life don't get scrutinised. They get forgotten. Madonna chose visibility over comfort. That choice is what keeps her culturally alive." color={DIM} />
            <Insight text="The engine doesn't defend this choice. It redirects attention from the discourse to the work. Every time the appearance conversation spikes, the response isn't engagement. It's a flood of artistry content that gives publications and fans something better to write about and share." color={DIM} />
            <Card accent={RED}>
              <p style={{ fontSize: 13, color: RED, fontWeight: 700, marginBottom: 6, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The rule that governs everything</p>
              <Insight text="Never play defence. The original doesn't explain itself. It doesn't justify its existence. It simply continues to create. The moment the engine starts arguing that Madonna is still relevant, it has already lost. The frame is always offensive: she is the source." color={DIM} />
            </Card>
          </Sect>
        </>}

        {tab === "audiences" && <>
          <Sect title="Who these people actually are">
            <Insight text="These aren't demographic segments. They're emotional relationships. Each cluster has a different reason for caring about Madonna, a different entry point into the catalogue, and a different thing they need from the cultural engine. The content that moves a nostalgia loyalist will bore a Gen Z discoverer. The content that excites a music purist will alienate a fashion follower. One brand truth, six different conversations." color={DIM} />
          </Sect>

          {[
            { name: "The nostalgia loyalists", age: "35-55", color: PURPLE, type: "Core base",
              why: "They don't just like Madonna's music. They are partially made of it. Specific songs are welded to specific memories: the summer of Like a Prayer, the club where they first heard Hung Up, the road trip soundtracked by Ray of Light. This isn't fandom. It's autobiography.",
              need: "They need the engine to honour what they already feel, not explain it to them. Archive content, vault drops, behind-the-scenes material they haven't seen. The emotional currency is recognition: 'you were there, and that mattered.'",
              risk: "Over-serving them at the expense of growth. They'll show up anyway. The engine must resist the temptation to make everything a nostalgia play." },
            { name: "The queer culture custodians", age: "25-50", color: PINK, type: "Core base",
              why: "For many LGBTQ+ people over 30, Madonna wasn't just an ally. She was the first famous person who made them feel like they weren't broken. The relationship is pre-career: it starts with Christopher Flynn, the gay dance teacher who told a teenage Madonna she was special. It runs through the AIDS crisis, Truth or Dare, Vogue, Stonewall. This isn't brand loyalty. It's a debt of recognition that goes both ways.",
              need: "Authenticity above everything. This cluster detects corporate Pride in milliseconds. Content must feel like it comes from inside the community, not from a brand addressing the community. The GLAAD speech, not the rainbow logo.",
              risk: "Tokenisation. The queer community is not a campaign beat. It's a year-round relationship. Activating only around Pride months signals inauthenticity." },
            { name: "The Gen Z discoverers", age: "16-26", color: TEAL, type: "Growth audience",
              why: "They didn't grow up with Madonna. They found her through an algorithm, a sample, a TikTok dance challenge, a thrift flip of a Gaultier-inspired outfit. Their relationship is curiosity, not loyalty. They're the most valuable growth audience because they don't have preconceptions. They're meeting the icon for the first time.",
              need: "Surprise over argument. 'Wait, SHE did that first?' is the reaction that converts curiosity into fandom. Side-by-side content. Short-form. The hook is the discovery itself. Never lecture. Never explain why she matters. Show them, and let the reaction be organic.",
              risk: "Cringe. A 67-year-old trying to speak Gen Z language will alienate this cluster instantly. The content must be native to their platforms but authored with the confidence of someone who doesn't need their approval." },
            { name: "The fashion and reinvention set", age: "20-45", color: Y, type: "Growth audience",
              why: "They see Madonna as a style architect, not primarily a musician. The Gaultier cone bra. The Blond Ambition tour. The Saint Laurent and D&G appearances in 2025-26. They care about the intersection of music and fashion as co-authored cultural moments. For them, Madonna didn't wear fashion. She changed what fashion meant.",
              need: "Craft content. Design detail. Archive-to-present continuity. The D&G relationship isn't a sponsorship. It's a 30-year creative dialogue. Show the thread across decades. Y2K vintage revival on Depop is her aesthetic being recycled. Own that conversation.",
              risk: "Reducing fashion to 'looking good.' This cluster cares about design intentionality, not glamour. Focus on the creative relationship, not the red carpet." },
            { name: "The feminist provocateurs", age: "25-45", color: AMBER, type: "Contested",
              why: "This is the split cluster. Half see Madonna as a feminist hero: bodily autonomy, sexual agency, refusal to perform ageing on society's terms. Half see her cosmetic choices as undermining the message. Both positions are genuine. Both coexist in the same publications, the same comment sections, sometimes the same person.",
              need: "The engine doesn't take sides in the debate. It reframes the terms. The question isn't 'has she had work done.' The question is 'why are we still policing women's faces in 2026.' The 'stick around' franchise handles this by making persistence the story, not appearance.",
              risk: "Engaging the appearance discourse directly. Every response, even a righteous one, amplifies the frame. Flood with artistry. Change the ratio." },
            { name: "The music purists", age: "30-60", color: GREEN, type: "Core base",
              why: "They judge Madonna against her own peak. Ray of Light, Confessions, Music. They know the production credits. They know the William Orbit collaboration changed electronic music. They're sceptical of the 2010s output but excited about the Stuart Price reunion because they understand what that partnership means sonically.",
              need: "Craft signals. Production diaries. Stuart Price in the studio. B-side drops. The Veronica Electronica material. This cluster doesn't want hype. They want evidence that the album is being made with the same care as the work they already love.",
              risk: "Overpromising. If the album doesn't deliver, this cluster will be the harshest critics. The engine should build anticipation through craft, not through claims. Let the music speak." },
          ].map((a, i) => (
            <Card key={i} accent={a.color}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: a.color, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{a.name}</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${a.color}22`, color: a.color, fontWeight: 600, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{a.type}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${MUTED}22`, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{a.age}</span>
                </div>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Why they care</p>
              <Insight text={a.why} color={DIM} />
              <p style={{ fontSize: 13, fontWeight: 700, color: WHITE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>What they need</p>
              <Insight text={a.need} color={DIM} />
              <p style={{ fontSize: 13, fontWeight: 700, color: RED, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Risk</p>
              <Insight text={a.risk} color={`${RED}BB`} />
            </Card>
          ))}
        </>}

        {tab === "territories" && <>
          <Sect title="Where to fight and where to walk away">
            <Insight text="A cultural territory is a space in public discourse where Madonna has permission to show up and be taken seriously. Permission isn't about reach or budget. It's about whether the audience believes she belongs there. Some territories she built. Some she shares. Some she's lost. And some she should never enter." color={DIM} />
          </Sect>

          {[
            { name: "Dance and club culture", score: 95, status: "Fortress", color: TEAL, franchise: "The floor remembers",
              substance: "Madonna has 50 Dance Club number-one singles. Fifty. More than any artist on any single Billboard chart. Confessions on a Dance Floor was a continuous 50-minute DJ set before that was a streaming format. Hung Up topped charts in 41 countries. The new album is a sequel to that record, with the same producer. The entire current dance revival (Beyonce's Renaissance, Charli XCX's brat, the club culture resurgence) traces back to ground she broke. She doesn't enter the revival. She IS what's being revived.",
              move: "Time the 'floor remembers' franchise to pre-album drop. The narrative isn't 'Madonna returns to dance music.' It's 'dance music returns to Madonna.'" },
            { name: "Queer liberation and Pride", score: 92, status: "Fortress", color: PURPLE, franchise: "The first friend you had",
              substance: "CNN's Anderson Cooper called her the ally who's had the biggest impact on LGBTQ+ acceptance. She put HIV education inside Like a Prayer album packaging during the Reagan era when the government was ignoring the crisis. Ellen DeGeneres credited Madonna with helping her come out. Truth or Dare documented gay lives when Hollywood wouldn't touch the subject. The Stonewall surprise performances aren't PR stunts. They're pilgrimages to a place that shaped her. The relationship started with Christopher Flynn, an openly gay dance teacher, when she was a teenager in Michigan. Before the career. Before the fame. Before there was anything to gain from allyship.",
              move: "This isn't a campaign territory. It's a relationship. The 'first friend you had' franchise treats it accordingly: community-first, year-round, not just Pride month. Content must feel like testimony, not brand activation." },
            { name: "Pop reinvention and eras", score: 82, status: "Strong", color: GREEN, franchise: "She did it first",
              substance: "She invented the concept of the pop era as a distinct visual and sonic world. 14 studio albums, each with a completely different identity. Vanity Fair credited her as the origin of what Taylor Swift now calls 'eras.' But the lineage has been buried. Younger audiences associate the concept with Swift, not Madonna. This is a territory she built but is losing credit for. The intelligence data shows 'Madonna eras' searches declining while 'Taylor Swift eras' searches grow. The lineage is being erased in real time.",
              move: "The 'she did it first' franchise addresses this through discovery, not argument. Never mention Swift. Never compare. Show the archive side by side with the artist she influenced. Let the audience connect the dots. The reaction 'wait, she did that FIRST?' is the conversion moment." },
            { name: "Ageism and bodily autonomy", score: 50, status: "Contested", color: AMBER, franchise: "Stick around",
              substance: "This is the hardest territory. It's also the most active conversation about Madonna in 2026. Search is dominated by cosmetic surgery speculation. Her own framing (ageism, misogyny) is accurate but the discourse is louder than the response. The feminist provocateur cluster is split. Some see her choices as undermining the message. Others (correctly) see the scrutiny itself as the problem. Both positions are genuine. The engine cannot resolve this debate. It can only change what dominates the conversation.",
              move: "DO NOT ENGAGE THE APPEARANCE FRAME DIRECTLY. It's a trap. Every response amplifies it. Instead: flood the zone with artistry content. Production diaries. Fashion collaborations. Archive essays. The Stuart Price reunion. The Netflix series development. Make the narrative about the work so the ratio of 'artistry' content to 'appearance' content shifts over six months. The 'stick around' franchise reframes persistence as the story. Her own quote is the hook: 'The most controversial thing I ever did was stick around.'" },
            { name: "Chart and streaming dominance", score: 25, status: "Ceded", color: RED, franchise: "None",
              substance: "Her last Hot 100 top 10 was 2008. Popular (2023) with The Weeknd charted but didn't dominate. This is structural, not a failure. The streaming economy favours younger artists with TikTok-native release cycles. Madonna will not out-chart Sabrina Carpenter or Chappell Roan. But chart position is the wrong metric for brand heat. A critically acclaimed dance album that generates six months of cultural conversation is worth more than a chart-chasing pop single that dilutes the brand.",
              move: "Accept this. Don't chase chart position with the new album. Measure success by cultural impact, critical reception, and whether it refreshes the brand narrative. Redefine what winning looks like for a legacy artist in 2026." },
          ].map((t, i) => (
            <Card key={i} accent={t.color}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: t.color, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{t.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: t.color, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{t.score}%</span>
                  <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: `${t.color}22`, color: t.color, fontWeight: 600, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{t.status}</span>
                </div>
              </div>
              <div style={{ width: "100%", height: 4, background: "#2A2A2A", borderRadius: 2, marginBottom: 12 }}>
                <div style={{ width: `${t.score}%`, height: "100%", background: t.color, borderRadius: 2 }} />
              </div>
              <Insight text={t.substance} color={DIM} />
              <div style={{ background: `${t.color}08`, border: `1px solid ${t.color}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: t.color, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Strategic move</p>
                <Insight text={t.move} color={DIM} />
              </div>
            </Card>
          ))}

          <Card accent={RED}>
            <p style={{ fontSize: 14, fontWeight: 700, color: RED, margin: "0 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Territories killed</p>
            {[
              { name: "Wellness and longevity", reason: "Any celebrity over 60 could run this. Fails the distinctiveness test." },
              { name: "AI and deepfake discourse", reason: "Makes her a subject of technology, not the icon herself." },
              { name: "Intergenerational relationship content", reason: "Feeds the ageism frame. Let it exist organically, don't build a franchise." },
            ].map((k, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: i < 2 ? `1px solid ${BORDER}` : "none" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{k.name}</span>
                <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>{k.reason}</span>
              </div>
            ))}
          </Card>
        </>}

        {tab === "engine" && <>
          <Sect title="The reactive nervous system">
            <Pull text="The engine doesn't create cultural moments. It detects them, maps them to the right franchise, and responds before the window closes." />
            <Insight text="Ten trigger types. Four speed tiers. Six era franchises as the content vocabulary. A five-rule kill filter before anything deploys. The intelligence layer (Apify social scraping, SimilarWeb digital footprint, sentiment classification) feeds signals into the system. The creative hierarchy decides what to say. The reactive framework decides when and how fast." color={DIM} />
          </Sect>

          <Sect title="The six content franchises" accent={CORAL}>
            <Insight text="Each franchise connects a specific Madonna era to something happening in culture right now. The era is the proof. The present is the point. These aren't throwback posts. They're recurring, formatised content series with established hooks, proof chains, and platform-native executions." color={DIM} />
            {[
              { name: "She did it first", era: "1984-86", color: Y, tension: "The lineage has been erased. Younger audiences associate 'eras' and reinvention with Swift, not Madonna. This franchise makes the invisible visible through side-by-side discovery." },
              { name: "Before you could say it", era: "1989-92", color: CORAL, tension: "Every conversation about female bodies, censorship, and sexual agency in 2026 was a conversation Madonna forced in 1989. The Pope condemned her. Pepsi dropped her. She did it anyway." },
              { name: "The floor remembers", era: "1990 + 2005", color: TEAL, tension: "Dance culture is resurgent but the conversation starts at 2022, not 1990. Vogue took ballroom to the mainstream. Confessions was an unbroken DJ set before streaming existed. The new album is the sequel." },
              { name: "When electronica was a risk", era: "1998", color: PURPLE, tension: "The biggest pop star alive abandoned pop for experimental electronica with William Orbit. The label thought she was finished. She won three Grammys. Veronica Electronica just resurfaced the unreleased material." },
              { name: "The first friend you had", era: "1991-now", color: PINK, tension: "Before corporate Pride, before rainbow logos, before it was safe. HIV inserts in Like a Prayer packaging. Truth or Dare. Stonewall. GLAAD's greatest ally. Not a campaign. A 40-year relationship." },
              { name: "Stick around", era: "1983-2026", color: WHITE, tension: "Her own words: 'The most controversial thing I ever did was stick around.' This franchise reframes persistence as provocation. In a culture that discards women after 40, she's still here. Still making. Still provoking." },
            ].map((f, i) => (
              <Card key={i} accent={f.color}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: f.color, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{f.name}</h3>
                  <span style={{ fontSize: 12, color: MUTED }}>{f.era}</span>
                </div>
                <Insight text={f.tension} color={DIM} />
              </Card>
            ))}
          </Sect>

          <Sect title="How the triggers connect" accent={TEAL}>
            <Insight text="When a cultural moment happens, the intelligence engine identifies which territory it touches, selects the right franchise, and produces content within the pre-assigned speed tier. The creative decisions are pre-made. The only decision in the moment is: deploy or don't." color={DIM} />
            <Card>
              {[
                { trigger: "Artist references Madonna", speed: "2 hours", franchise: "She did it first", why: "The window is narrow. Miss it and you're commenting on old news." },
                { trigger: "Appearance discourse spikes", speed: "24 hours", franchise: "Stick around", why: "DO NOT ENGAGE. Deploy artistry content. Change the ratio, not the argument." },
                { trigger: "Pride or LGBTQ+ milestone", speed: "Planned", franchise: "First friend you had", why: "Predictable calendar. Pre-produce. Quality over speed." },
                { trigger: "Dance culture trends", speed: "4-8 hours", franchise: "Floor remembers", why: "The new album makes every dance moment a content trigger." },
                { trigger: "Fan content goes viral", speed: "2 hours", franchise: "Match to content", why: "This is the Gen Z acquisition engine. Stitch. Duet. Amplify with paid if 8%+ engagement holds." },
              ].map((t, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < 4 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{t.trigger}</span>
                    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: `${Y}22`, color: Y, fontWeight: 600, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{t.speed}</span>
                  </div>
                  <div style={{ fontSize: 12, color: TEAL, marginBottom: 2, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{t.franchise}</div>
                  <Insight text={t.why} color={MUTED} />
                </div>
              ))}
            </Card>
          </Sect>
        </>}

        {tab === "channels" && <>
          <Sect title="Where human attention actually lives">
            <Pull text="Not all reach is equal. A £2 CPM nobody remembers costs more than a £10 CPM that builds the brand." />
            <Insight text="The channel architecture is weighted by attention, not by platform popularity. YouTube at $0.96 per thousand attentive seconds is the most efficient attention buy in the stack. The 60:40 Binet & Field split separates brand building (memory formation, long-term equity) from activation (conversation, velocity, cultural temperature). Every channel earns its place by delivering real human attention against the right audience cluster." color={DIM} />
          </Sect>

          <Sect title="Brand building — 60-65% of budget" accent={CORAL}>
            <Insight text="These are the formats where you earn the 2.5+ seconds needed for memory encoding. The science is clear: below 2.5 seconds of attention, memory encoding is significantly weaker. Brand building requires formats that earn sustained attention and build emotional association over time." color={DIM} />
            <Card>
              {[
                { ch: "YouTube", apm: "5,200", acpm: "$0.96", why: "Most efficient attention buy. Long-form essay and documentary content. Production diaries. 'Before you could say it' and 'When electronica was a risk' franchises live here." },
                { ch: "Podcasts (host-read)", apm: "11,000", acpm: "$2.27", why: "Highest notice rate (82%). Music, culture, fashion podcast partnerships. Long-form storytelling. The 'first friend you had' franchise gets depth here that social can't provide." },
                { ch: "CTV and BVOD", apm: "13,800", acpm: "$1.49", why: "TV-level attention in a digital wrapper. Archive-led brand films. Pre-album campaign. The kind of emotional, high-production content that builds memory structures." },
                { ch: "OOH", apm: "—", acpm: "—", why: "Iconic moments around album launch. Fashion week adjacency. Physical presence signals scale and permanence. A billboard doesn't get scrolled past." },
              ].map((c, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < 3 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{c.ch}</span>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 12, color: CORAL }}>{c.apm} APM</span>
                      <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>{c.acpm}</span>
                    </div>
                  </div>
                  <Insight text={c.why} color={MUTED} />
                </div>
              ))}
            </Card>
          </Sect>

          <Sect title="Activation — 35-40% of budget" accent={TEAL}>
            <Insight text="These formats drive conversation, not memory. They feed the earned media machine. They're where the reactive triggers fire. The content is platform-native, lo-fi where appropriate, and designed for saves and shares (the only social metrics that predict cultural velocity)." color={DIM} />
            <Card>
              {[
                { ch: "TikTok", role: "Gen Z discovery engine. Side-by-side content. 'She did it first' franchise. Fan content amplification. 3,400 APM." },
                { ch: "Instagram Reels + Stories", role: "Fashion and style community. Archive-to-present carousels. Designer collaboration content. 2,100 APM." },
                { ch: "X / Twitter", role: "Real-time cultural commentary. Archive images deployed during cultural triggers. Restraint as flex. Minimal captions." },
                { ch: "Spotify", role: "Curated playlists. Algorithmic discovery. Pre-album playlist seeding. Catalogue positioning alongside current artists." },
              ].map((c, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i < 3 ? `1px solid ${BORDER}` : "none" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEAL, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{c.ch}</span>
                  <Insight text={c.role} color={MUTED} />
                </div>
              ))}
            </Card>
          </Sect>

          <Sect title="The paid-earned-owned loop" accent={PURPLE}>
            <Card accent={PURPLE}>
              <Insight text="Owned builds the base: madonna.com as a living cultural archive (not a merch store), email and SMS for superfan community, streaming profiles as curated brand experiences. This is the always-on layer." color={DIM} />
              <Insight text="Earned is generated by the reactive content system. When the trigger-response framework fires fast enough and sharp enough, publications pick it up. The goal: Madonna's team should be the fastest, sharpest cultural commentator in the music space. Earned becomes predictable, not hoped for." color={DIM} />
              <Insight text="Paid amplifies winners only. Nothing gets paid budget until it proves organic engagement first (the 8-12% engagement threshold from the virality skill). Paid seeds to adjacent audiences who don't currently follow Madonna. The feedback loop: performance data from paid informs the intelligence engine, which updates territory scores and trigger sensitivity." color={DIM} />
            </Card>
          </Sect>

          <Card accent={Y}>
            <p style={{ fontSize: 14, fontWeight: 700, color: Y, margin: "0 0 6px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Measurement principles</p>
            <Insight text="Save rate and share rate are the primary social metrics. They predict cultural velocity where views and likes measure activity without impact. Brand lift studies run quarterly to track unprompted association shifts. Incrementality testing (geo holdouts where budget allows) validates that paid activity is driving genuine uplift, not claiming organic demand. Every channel is evaluated on cost per attentive second, not raw CPM, because attention is the gateway to memory and memory is the gateway to brand equity." color={MUTED} />
          </Card>
        </>}

        {tab === "britishgas" && <>
          <Sect title="What people are actually saying">
            <Pull text="We scraped 50 TikTok videos, PopJustice forum threads, Reddit fan communities, and Instagram comments. Here's what the data reveals about how people talk about Madonna in April 2026." />
            <Insight text="The intelligence engine doesn't start with what Madonna wants to say. It starts with what people are already feeling, sharing, and saving. The Pulse methodology: scrape what's trending, score by save rate and share rate, classify the emotional territory, and build content back from the human truth underneath." color={DIM} />
          </Sect>

          <Sect title="Conversation territory 1: The anticipation" accent={TEAL}>
            <Card accent={TEAL}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: TEAL, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Album anticipation is the dominant positive signal</p>
                <span style={{ fontSize: 12, color: TEAL, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>451K top plays</span>
              </div>
              <Insight text="Metro Entertainment's COADF Part 2 announcement video hit 451,300 plays, 28,500 likes, 2,447 shares, and 1,728 saves. That's from a 305K follower account, meaning the content significantly outperformed the base. The save rate signals genuine intent: people are bookmarking this to come back to. They want to be ready." color={DIM} />
              <Insight text="The fan forum discourse on PopJustice reveals something deeper. Fans aren't just excited. They're anxious. The Stuart Price reunion generates genuine hope because his name is attached to the last album they universally loved. But there's a fear underneath: 'her previous three studio albums didn't result in any Grammy nominations.' The anticipation is conditional. It's 'please let this be the one.'" color={DIM} />
              <div style={{ background: `${TEAL}08`, border: `1px solid ${TEAL}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEAL, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="The fans haven't lost faith in Madonna. They've lost faith in the albums. The Stuart Price reunion is the first time in a decade they've felt permission to believe again. The content engine's job: protect that anticipation. Feed it with craft signals (production diaries, B-side drops, Price studio content). Never overpromise. Let the music speak." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 2: The archive worship" accent={PURPLE}>
            <Card accent={PURPLE}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: PURPLE, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Archive and tour footage massively outperforms new content</p>
                <span style={{ fontSize: 12, color: PURPLE, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>684K top plays</span>
              </div>
              <Insight text="The single highest-performing TikTok in our scrape isn't about the new album. It's @madonna_tours posting Blond Ambition Tour footage from 1990: 684,300 plays, 61,900 likes, and 7,028 saves from a 23,500 follower account. That's a 29x follower multiplier. @madonnabloom's Virgin Tour 'Dress You Up' clip hit 656,900 plays with 39,400 likes and 3,227 saves from 110K followers." color={DIM} />
              <Insight text="The data is unambiguous: the catalogue IS the content. Archive footage consistently generates the highest engagement rates in the entire Madonna TikTok ecosystem. And the saves are disproportionately high, meaning people aren't just watching. They're collecting. They're building personal archives of her legacy." color={DIM} />
              <div style={{ background: `${PURPLE}08`, border: `1px solid ${PURPLE}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: PURPLE, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="People don't want to be told Madonna is iconic. They want to experience it themselves. The archive footage doesn't need commentary. The performance IS the argument. This validates the 'she did it first' franchise structure: show the archive, let the audience draw the line to the present. The proof doesn't need a narrator." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 3: The family Madonna" accent={CORAL}>
            <Card accent={CORAL}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: CORAL, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Rocco, the kids, and the human behind the icon</p>
                <span style={{ fontSize: 12, color: CORAL, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>581K plays</span>
              </div>
              <Insight text="Rocco Ciccone's 'Habibi Let's Celebrate' New Year video hit 581,300 plays, 25,900 likes, 2,358 shares, and 1,679 saves. From a 110K account, that's massive organic reach. The Morocco family content, the makeup-free Hanukkah photos with daughters Stella and Estere, the D&G show with Lourdes Leon — this content performs because it shows the human being inside the icon." color={DIM} />
              <Insight text="The fan comments on her New Year post tell the story: 'We were waiting for these photos, it's a celebration! 2026 is going to be you and us, the fans.' The possessive 'you and us' is significant. The fans see themselves as participants in Madonna's life, not just consumers of her output. The family content makes that feel reciprocal." color={DIM} />
              <div style={{ background: `${CORAL}08`, border: `1px solid ${CORAL}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: CORAL, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="The audience doesn't just want the icon. They want the person. The family content humanises without diminishing. It shows Madonna as a mother, a partner, a person who celebrates holidays and takes her kids to Morocco. This is the emotional layer that the 'stick around' franchise can draw from: persistence isn't just about career longevity. It's about still being present as a full human being." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 4: The fashion authority" accent={Y}>
            <Card accent={Y}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: Y, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Milan, Paris, D&G: the fashion presence is live</p>
                <span style={{ fontSize: 12, color: Y, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Active Q1 2026</span>
              </div>
              <Insight text="Vogue Taiwan covered Madonna at Saint Laurent SS2026 with Lourdes Leon and Akeem Morris (14,100 plays). Fan accounts documented her D&G FW2026 Milan appearance in detail. The La Bambola performance at D&G's Alta Moda salon generated coverage from Popline Brazil (84,200 plays, 7,908 likes). The fashion conversation is the only territory where the discourse is overwhelmingly positive with almost no appearance commentary." color={DIM} />
              <div style={{ background: `${Y}08`, border: `1px solid ${Y}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: Y, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="Fashion is the safe harbour. When Madonna is discussed in a fashion context, the conversation centres on craft, design, and creative relationships, not on her face. This is where the 'she did it first' franchise has the cleanest entry point. The D&G relationship spans decades. The Saint Laurent presence signals ongoing relevance. The fashion territory is where the appearance-to-artistry ratio is already favourable. Double down here." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="Conversation territory 5: The sceptics" accent={AMBER}>
            <Card accent={AMBER}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: AMBER, margin: 0, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>The conditional believers and the album anxiety</p>
                <span style={{ fontSize: 12, color: AMBER, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>PopJustice, Reddit</span>
              </div>
              <Insight text="The PopJustice forum thread on Madonna's 15th album runs to multiple pages of deep, passionate, anxious debate. The core tension: fans want to believe but they've been hurt before. 'Her previous three studio albums didn't result in any nominations.' 'I've never been a massive fan of Max Martin's stuff. It's rarely interesting and I wouldn't call him an innovator.' 'Madonna's best work was often with producers who were slightly avant-garde and experimental.'" color={DIM} />
              <Insight text="But then the counter-voices: 'She's clearly got something to prove, and we know how mother gets when she's really hungry.' 'Somewhere between Ray of Light and Confessions lies what we all need. She needs to reclaim the dance floor in a big way.' One fan described listening to Ray of Light for the first time and ordering the vinyl immediately. The love is conditional, but the conditions are being met: Stuart Price, Warner Records, dance floor, no compromises." color={DIM} />
              <div style={{ background: `${AMBER}08`, border: `1px solid ${AMBER}22`, borderRadius: 8, padding: "10px 14px", marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: AMBER, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Human truth underneath</p>
                <Insight text="The music purists are the canary in the coal mine. If they believe, the album has a shot at critical reappraisal. If they don't, the narrative stays stuck on nostalgia and appearance. The 'when electronica was a risk' franchise speaks directly to this cluster: it reminds them that Madonna has been here before, choosing the risky path when the safe one was available, and being vindicated by the work. The Stuart Price reunion IS the signal they need. The engine's job is to make sure they see it." color={DIM} />
              </div>
            </Card>
          </Sect>

          <Sect title="The content-back model" accent={Y}>
            <Pull text="This is the Pulse methodology. Scrape what people say. Score by saves and shares. Find the human truth. Build content back from the need." />

            <p style={{ fontSize: 13, fontWeight: 700, color: Y, marginBottom: 12, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>Live feed: top performing Madonna TikToks (scraped April 2026)</p>

            {[
              { author: "themadonnatiktoks", fans: "173K", plays: "1.1M", likes: "73.5K", shares: "5,758", saves: "5,723", comments: "1,022", text: "Gen X Madonna icon compilation edit", url: "https://www.tiktok.com/@themadonnatiktoks/video/7412775885494963489", territory: "Archive worship", saveRate: "0.52%", date: "Sep 2024" },
              { author: "madonna_tours", fans: "23.5K", plays: "684K", likes: "61.9K", shares: "2,172", saves: "7,028", comments: "695", text: "Act of Contrition / Like a Prayer — Blond Ambition Tour 1990", url: "https://www.tiktok.com/@madonna_tours/video/7350707569377201414", territory: "Archive worship", saveRate: "1.03%", date: "Mar 2024" },
              { author: "madonnabloom", fans: "110K", plays: "657K", likes: "39.4K", shares: "4,640", saves: "3,227", comments: "1,789", text: "Dress You Up — The Virgin Tour (1985)", url: "https://www.tiktok.com/@madonnabloom/video/7544004309982170369", territory: "Archive worship", saveRate: "0.49%", date: "Aug 2025" },
              { author: "roccoccicone", fans: "110K", plays: "581K", likes: "25.9K", shares: "2,358", saves: "1,679", comments: "1,036", text: "Habibi Let's Celebrate 2026! Family New Year in Morocco", url: "https://www.tiktok.com/@roccoccicone/video/7591252603690814751", territory: "Family Madonna", saveRate: "0.29%", date: "Jan 2026" },
              { author: "__mrecords__", fans: "34K", plays: "502K", likes: "2.1K", shares: "153", saves: "385", comments: "98", text: "Madonna's evolution from the '80s to today — still iconic, still the Queen of Pop", url: "https://www.tiktok.com/@__mrecords__/video/7556987231324441878", territory: "Contested: ageing", saveRate: "0.08%", date: "Oct 2025" },
              { author: "metroentertainment", fans: "305K", plays: "451K", likes: "28.5K", shares: "2,447", saves: "1,728", comments: "508", text: "COADF Part 2 announced — every pop girl should be scared", url: "https://www.tiktok.com/@metroentertainment/video/7551432107860495638", territory: "Album anticipation", saveRate: "0.38%", date: "Sep 2025" },
              { author: "madonnabloom", fans: "110K", plays: "361K", likes: "17.2K", shares: "1,918", saves: "2,904", comments: "359", text: "Vogue — MTV VMAs 1990 performance", url: "https://www.tiktok.com/@madonnabloom/video/7279546435320810757", territory: "Archive worship", saveRate: "0.80%", date: "Sep 2023" },
              { author: "themadonnatiktoks", fans: "173K", plays: "196K", likes: "16.6K", shares: "1,000", saves: "1,382", comments: "285", text: "Gen X Madonna forever compilation", url: "https://www.tiktok.com/@themadonnatiktoks/video/7481753283892235542", territory: "Archive worship", saveRate: "0.71%", date: "Mar 2025" },
              { author: "dieguitopaes", fans: "16.4K", plays: "87.6K", likes: "497", shares: "42", saves: "97", comments: "11", text: "Madonna performing Hung Up at Coachella 2006 — nostalgia pop culture", url: "https://www.tiktok.com/@dieguitopaes/video/7498379640860347653", territory: "Archive worship", saveRate: "0.11%", date: "Apr 2025" },
              { author: "elheraldodemexico", fans: "8.2M", plays: "86.5K", likes: "7.2K", shares: "244", saves: "678", comments: "319", text: "La Reina del Pop regresa — COADF Part 2 announcement (Spanish)", url: "https://www.tiktok.com/@elheraldodemexico/video/7572406477231590712", territory: "Album anticipation", saveRate: "0.78%", date: "Nov 2025" },
              { author: "popline", fans: "2.3M", plays: "84.2K", likes: "7.9K", shares: "198", saves: "514", comments: "185", text: "La Bambola performance at Dolce & Gabbana — comeback aquecendo", url: "https://www.tiktok.com/@popline/video/7613561344109071636", territory: "Fashion authority", saveRate: "0.61%", date: "Mar 2026" },
              { author: "elliehenman", fans: "7.4K", plays: "45.4K", likes: "4.2K", shares: "530", saves: "347", comments: "201", text: "Madonna filming top secret music comeback in UK — 41 dancers, 200+ crew", url: "https://www.tiktok.com/@elliehenman/video/7613121124339076374", territory: "Album anticipation", saveRate: "0.76%", date: "Mar 2026" },
              { author: "ikaiique_", fans: "5.2K", plays: "46.3K", likes: "5.9K", shares: "84", saves: "554", comments: "229", text: "Confessions on a Dance Floor track ranking — fan discourse", url: "https://www.tiktok.com/@ikaiique_/video/7458435542590573829", territory: "Music purists", saveRate: "1.20%", date: "Jan 2025" },
              { author: "omuriloronchi", fans: "16.2K", plays: "11K", likes: "1.6K", shares: "151", saves: "114", comments: "115", text: "Madonna feat. Britney Spears rumour on new album — fan speculation", url: "https://www.tiktok.com/@omuriloronchi/video/7626537396481445138", territory: "Album anticipation", saveRate: "1.04%", date: "Apr 2026" },
              { author: "hudkonsulenten", fans: "4.4K", plays: "5.4K", likes: "216", shares: "42", saves: "57", comments: "5", text: "'To age is a sin' — reaction to Madonna's 2016 Billboard speech on ageism", url: "https://www.tiktok.com/@hudkonsulenten/video/7555624479917935894", territory: "Ageism reframe", saveRate: "1.05%", date: "Sep 2025" },
            ].map((p, i) => {
              const territoryColors = { "Archive worship": PURPLE, "Family Madonna": CORAL, "Album anticipation": TEAL, "Fashion authority": Y, "Music purists": GREEN, "Contested: ageing": AMBER, "Ageism reframe": AMBER };
              const tc = territoryColors[p.territory] || MUTED;
              return (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", background: CARD, borderRadius: 10, padding: "14px 18px", border: `1px solid ${BORDER}`, marginBottom: 8, transition: "border-color 0.15s", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = tc}
                  onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: WHITE, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>@{p.author}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>{p.fans} followers</span>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${tc}22`, color: tc, fontWeight: 600, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{p.territory}</span>
                  </div>
                  <p style={{ fontSize: 13, color: DIM, lineHeight: 1.5, margin: "0 0 8px" }}>{p.text}</p>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: MUTED, flexWrap: "wrap" }}>
                    <span><span style={{ color: WHITE, fontWeight: 600 }}>{p.plays}</span> plays</span>
                    <span><span style={{ color: WHITE, fontWeight: 600 }}>{p.likes}</span> likes</span>
                    <span><span style={{ color: TEAL, fontWeight: 600 }}>{p.shares}</span> shares</span>
                    <span><span style={{ color: PURPLE, fontWeight: 600 }}>{p.saves}</span> saves</span>
                    <span><span style={{ color: tc, fontWeight: 700 }}>{p.saveRate}</span> save rate</span>
                    <span style={{ marginLeft: "auto", color: MUTED }}>{p.date}</span>
                  </div>
                </a>
              );
            })}

            <Card accent={Y}>
              <p style={{ fontSize: 13, fontWeight: 700, color: Y, margin: "0 0 8px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>What the data tells us</p>
              {[
                { signal: "Archive tour footage dominates everything", insight: "7 of the top 15 posts are archive performances. Blond Ambition, VMAs, Virgin Tour, Confessions Tour. Save rates on archive content (0.49-1.03%) consistently outperform new content. The catalogue IS the engine.", color: PURPLE },
                { signal: "Save rate is the real quality signal", insight: "A COADF track ranking from a 5K-follower account hit 1.20% save rate. The Billboard ageism speech reaction hit 1.05%. Britney Spears album rumour hit 1.04%. High save rate from small accounts = genuine audience intent, not algorithmic luck.", color: TEAL },
                { signal: "Spanish and Portuguese language content is massive", insight: "El Heraldo de Mexico (86K plays), Popline Brazil (84K plays). The Latin fanbase is producing and consuming Madonna content at scale. The engine should be multilingual, not English-only.", color: CORAL },
                { signal: "The music video shoot leak drove real excitement", insight: "Ellie Henman's exclusive about Madonna filming in the UK with 41 dancers and 200+ crew hit 45K plays from a 7K account. That's a 6x follower multiplier. Behind-the-scenes production content generates genuine anticipation. Feed this.", color: GREEN },
                { signal: "The 'evolution' / before-and-after format is contested", insight: "MRecords' evolution compilation hit 502K plays but only 0.08% save rate. High views, low saves. People watch but don't keep it. This format feeds the appearance discourse more than the artistry narrative. Deprioritise.", color: AMBER },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i < 4 ? `1px solid ${BORDER}` : "none" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: s.color, margin: "0 0 4px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{s.signal}</p>
                  <Insight text={s.insight} color={DIM} />
                </div>
              ))}
            </Card>

            <Card accent={TEAL}>
              <p style={{ fontSize: 13, fontWeight: 700, color: TEAL, margin: "0 0 6px", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>How the Spark Board powers this</p>
              <Insight text="The same Apify pipeline that powers Firepit's content intelligence runs here. Scheduled TikTok scrapes across Madonna hashtags and search terms, scored by save rate and share rate, classified by conversation territory. The intelligence layer surfaces which territories are heating up or cooling down week over week. The content brief generator produces weekly briefs mapped to the six era franchises. One tool architecture. Two completely different clients. Same methodology: listen first, build content back from what people actually need." color={DIM} />
            </Card>
          </Sect>
        </>}

        <div style={{ marginTop: 48, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>VCCP Media × Cultural intelligence</span>
          <span style={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>The original. Not the comeback.</span>
        </div>
      </div>
    </div>
  );
}

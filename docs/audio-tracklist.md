# Confluence Pilot Audio Track List

This is the first-pass audio target list for the pilot. It deliberately avoids one distinct music track per room. The goal is a coherent shared sound world that can be reused across all 12 rooms, with room identity handled by Web Audio filtering, pitch, gain, and spatial modulation.

## Music Beds

### 1. `confluence-ambient-main`
- Type: instrumental ambient music loop
- Target duration: 90 seconds
- Looping: yes
- Use: primary shared music bed for the full pilot
- Direction: calm wonder, intelligent exhibition space, warm low drone, airy granular shimmer, very slow harmonic motion
- Harmonic center: F minor with suspended Bb color
- Avoid: drums, pop song structure, lead melody, lyrics, busy arpeggios

### 2. `ambient-room-bed`
- Type: subtle environmental ambience loop
- Target duration: 30 seconds
- Looping: yes
- Use: low-level layer under the main bed when the user is settled in a room
- Direction: deep room tone, faint air movement, electrical life, glassy harmonic shimmer
- Avoid: melody, beat, voices, recognizable machinery

## Navigation Effects

### 3. `transition-forward`
- Type: one-shot transition sound
- Target duration: 4 seconds
- Looping: no
- Use: moving forward/up through the vertical room conduit
- Direction: soft filtered air pressure rising, glass shimmer, subtle low-frequency sweep
- Avoid: explosion, hard hit, aggressive trailer whoosh

### 4. `transition-back`
- Type: one-shot transition sound
- Target duration: 4 seconds
- Looping: no
- Use: moving backward/down through the vertical room conduit
- Direction: airy filtered descent, falling low resonance, distant glass harmonics
- Avoid: comic reverse sound, hard brake, harsh transient

### 5. `room-arrival-chime`
- Type: one-shot arrival cue
- Target duration: 3 seconds
- Looping: no
- Use: after a room settles as a soft confirmation
- Direction: single sine-like bell, warm sub resonance, crystalline tail, spacious reverb
- Avoid: notification sound, UI beep, obvious melody

## Interface Effects

### 6. `sound-toggle`
- Type: one-shot UI sound
- Target duration: 1 second
- Looping: no
- Use: sound on/off control
- Direction: small polished tactile click with a soft tonal tail
- Avoid: phone tap, plastic button, loud switch

### 7. `focus-hover`
- Type: very quiet UI texture
- Target duration: 1 second
- Looping: no
- Use: optional future hover/focus affordance for selected controls
- Direction: barely audible glass-air tick, more felt than heard
- Avoid: repeated annoyance, pitchy chirp

## Implementation Notes

- The first generation pass should create tracks 1-5 only.
- Tracks 6-7 are reserved until the UI actually needs them.
- Room variation should come from the existing Web Audio engine:
  - `setRoomTone(roomIndex)` adjusts pitch/filter per room.
  - transition direction selects `transition-forward` or `transition-back`.
  - arrival cues can be pitch-shifted or filtered per room instead of regenerated.
- If ElevenLabs voice material is added later, treat it as a texture layer, not room-specific narration.

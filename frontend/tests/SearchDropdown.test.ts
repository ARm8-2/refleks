import { filterAndSortOptions, SearchDropdownOption } from "../src/components/shared/SearchDropdown";


describe("filterAndSortOptions", () => {
  const options: SearchDropdownOption[] = [
    { label: "Ground Plaza Easy", value: "Ground Plaza Easy" },
    { label: "Ground Plaza NO UFO", value: "Ground Plaza NO UFO" },
    { label: "Ground Plaza Sparky v3 OW", value: "Ground Plaza Sparky v3 OW" },
    { label: "Kindaclose Long Strafes", value: "Kindaclose Long Strafes" },
    { label: "LilithXYZ", value: "LilithXYZ" },
    { label: "Midrange Long Strafes Invincible", value: "Midrange Long Strafes Invincible" },
    { label: "Pasu Track Wide React", value: "Pasu Track Wide React" },
    { label: "Plink Plaza", value: "Plink Plaza" },
    { label: "Psalm Control Lilith medium", value: "Psalm Control Lilith medium" },
    { label: "Tracking God Aoi", value: "Tracking God Aoi" },
    { label: "VSS GP9", value: "VSS GP9" },
    { label: "VSS GPAIO", value: "VSS GPAIO" },
    { label: "VSS GPAIO thin far bots", value: "VSS GPAIO thin far bots" },
    { label: "VT ControlTS Advanced S5", value: "VT ControlTS Advanced S5" },
    { label: "VT ControlTS Intermediate S5", value: "VT ControlTS Intermediate S5" },
    { label: "VT FlyTS Advanced S5", value: "VT FlyTS Advanced S5" },
    { label: "1w2ts Angelic Easy", value: "1w2ts Angelic Easy" },
    { label: "Aimerz+ VGS Med S1", value: "Aimerz+ VGS Med S1" },
    { label: "Air Angelic 3478 Fixed", value: "Air Angelic 3478 Fixed" },
    { label: "Air CELESTIAL", value: "Air CELESTIAL" },
    { label: "Air Divine", value: "Air Divine" },
    { label: "Air invincible 8 small", value: "Air invincible 8 small" },
    { label: "cAt sausageTrack Normal", value: "cAt sausageTrack Normal" },
    { label: "Centering I 180", value: "Centering I 180" },
    { label: "Centering I Easy", value: "Centering I Easy" },
    { label: "Centering II 180", value: "Centering II 180" },
    { label: "Close Fast Strafes Invincible", value: "Close Fast Strafes Invincible" },
    { label: "Close Long Strafes Invincible", value: "Close Long Strafes Invincible" },
    { label: "Controlsphere", value: "Controlsphere" },
    { label: "Controlsphere OW", value: "Controlsphere OW" },
    { label: "Controlsphere OW 150%", value: "Controlsphere OW 150%" },
    { label: "gp close long strafes", value: "gp close long strafes" },
    { label: "Ground Plaza", value: "Ground Plaza" },
    { label: "Microshot Flick", value: "microshot" },
    { label: "beanClick Micro 30% Smaller", value: "beanClick" },
    { label: "1w3ts Micro Angelic Easy", value: "1w3tsMicroAngelicEasy" },
    { label: "1w2ts Angelic", value: "1w2tsAngelic" },
    { label: "1w2ts Angelic Easy", value: "1w2tsAngelicEasy" },
    { label: "400ms strafing Reflex Micro++", value: "400msReflexMicro" },
    { label: "Micro Angelic", value: "microAngelic" },
    { label: "Micro Angelic Easy", value: "microAngelicEasy" },
    { label: "VT Plaza Viscose Thin", value: "VT Plaza Viscose Thin" },
    { label: "VT ww5t Intermediate S5", value: "VT ww5t Intermediate S5" }
  ];

  it("sorts by exact match, label starts with, all words present", () => {
    // No exact match for "VT Plaza Viscose Thin" and "VT FlyTS Advanced S5" with "VT Plaza"
    expect(filterAndSortOptions(options, "VT Plaza")).toEqual([
      { label: "VT Plaza Viscose Thin", value: "VT Plaza Viscose Thin" }
    ]);
  });

  it("sorts by earliest match", () => {
    expect(filterAndSortOptions(options, "gp")).toEqual([
      { label: "gp close long strafes", value: "gp close long strafes" },
      { label: "VSS GP9", value: "VSS GP9" },
      { label: "VSS GPAIO", value: "VSS GPAIO" },
      { label: "VSS GPAIO thin far bots", value: "VSS GPAIO thin far bots" }
    ]);
  });

  it("handles multiple words in search", () => {
    expect(filterAndSortOptions(options, "invin")).toEqual([
      { label: "Air invincible 8 small", value: "Air invincible 8 small" },
      { label: "Close Fast Strafes Invincible", value: "Close Fast Strafes Invincible" },
      { label: "Close Long Strafes Invincible", value: "Close Long Strafes Invincible" },
      { label: "Midrange Long Strafes Invincible", value: "Midrange Long Strafes Invincible" }
    ]);
    expect(filterAndSortOptions(options, "invin stra")).toEqual([
      { label: "Close Fast Strafes Invincible", value: "Close Fast Strafes Invincible" },
      { label: "Close Long Strafes Invincible", value: "Close Long Strafes Invincible" },
      { label: "Midrange Long Strafes Invincible", value: "Midrange Long Strafes Invincible" }
    ]);
  });

  it("prioritizes label starts with search term", () => {
    expect(filterAndSortOptions(options, "Micro")).toEqual([
      { label: "Micro Angelic", value: "microAngelic" },
      { label: "Micro Angelic Easy", value: "microAngelicEasy" },
      { label: "1w3ts Micro Angelic Easy", value: "1w3tsMicroAngelicEasy" },
      { label: "beanClick Micro 30% Smaller", value: "beanClick" },
      { label: "Microshot Flick", value: "microshot" },
      { label: "400ms strafing Reflex Micro++", value: "400msReflexMicro" }
    ]);
  });

  it("returns all options sorted alphabetically if search is empty", () => {
    const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label));
    expect(filterAndSortOptions(options, "")).toEqual(sorted);
  });

  it("returns empty array if no options match all words", () => {
    expect(filterAndSortOptions(options, "foobar")).toEqual([]);
    expect(filterAndSortOptions(options, "VT foobar")).toEqual([]);
  });
});

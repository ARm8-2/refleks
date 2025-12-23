export namespace models {
	
	export class AIOptions {
	    maxRunsPerScenario: number;
	    systemPersona: string;
	
	    static createFrom(source: any = {}) {
	        return new AIOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.maxRunsPerScenario = source["maxRunsPerScenario"];
	        this.systemPersona = source["systemPersona"];
	    }
	}
	export class BenchmarkSubcategory {
	    subcategoryName: string;
	    scenarioCount: number;
	    color?: string;
	
	    static createFrom(source: any = {}) {
	        return new BenchmarkSubcategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subcategoryName = source["subcategoryName"];
	        this.scenarioCount = source["scenarioCount"];
	        this.color = source["color"];
	    }
	}
	export class BenchmarkCategory {
	    categoryName: string;
	    color?: string;
	    subcategories: BenchmarkSubcategory[];
	
	    static createFrom(source: any = {}) {
	        return new BenchmarkCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.categoryName = source["categoryName"];
	        this.color = source["color"];
	        this.subcategories = this.convertValues(source["subcategories"], BenchmarkSubcategory);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BenchmarkDifficulty {
	    difficultyName: string;
	    kovaaksBenchmarkId: number;
	    sharecode: string;
	    rankColors: Record<string, string>;
	    categories: BenchmarkCategory[];
	
	    static createFrom(source: any = {}) {
	        return new BenchmarkDifficulty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.difficultyName = source["difficultyName"];
	        this.kovaaksBenchmarkId = source["kovaaksBenchmarkId"];
	        this.sharecode = source["sharecode"];
	        this.rankColors = source["rankColors"];
	        this.categories = this.convertValues(source["categories"], BenchmarkCategory);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Benchmark {
	    benchmarkName: string;
	    rankCalculation: string;
	    abbreviation: string;
	    color: string;
	    spreadsheetURL: string;
	    difficulties: BenchmarkDifficulty[];
	
	    static createFrom(source: any = {}) {
	        return new Benchmark(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.benchmarkName = source["benchmarkName"];
	        this.rankCalculation = source["rankCalculation"];
	        this.abbreviation = source["abbreviation"];
	        this.color = source["color"];
	        this.spreadsheetURL = source["spreadsheetURL"];
	        this.difficulties = this.convertValues(source["difficulties"], BenchmarkDifficulty);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class ScenarioProgress {
	    name: string;
	    score: number;
	    scenarioRank: number;
	    thresholds: number[];
	    energy?: number;
	    progress: number;
	
	    static createFrom(source: any = {}) {
	        return new ScenarioProgress(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.score = source["score"];
	        this.scenarioRank = source["scenarioRank"];
	        this.thresholds = source["thresholds"];
	        this.energy = source["energy"];
	        this.progress = source["progress"];
	    }
	}
	export class ProgressGroup {
	    name?: string;
	    color?: string;
	    scenarios: ScenarioProgress[];
	    energy?: number;
	
	    static createFrom(source: any = {}) {
	        return new ProgressGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.color = source["color"];
	        this.scenarios = this.convertValues(source["scenarios"], ScenarioProgress);
	        this.energy = source["energy"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProgressCategory {
	    name: string;
	    color?: string;
	    groups: ProgressGroup[];
	
	    static createFrom(source: any = {}) {
	        return new ProgressCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.color = source["color"];
	        this.groups = this.convertValues(source["groups"], ProgressGroup);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RankDef {
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new RankDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class BenchmarkProgress {
	    overallRank: number;
	    benchmarkProgress: number;
	    ranks: RankDef[];
	    categories: ProgressCategory[];
	
	    static createFrom(source: any = {}) {
	        return new BenchmarkProgress(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.overallRank = source["overallRank"];
	        this.benchmarkProgress = source["benchmarkProgress"];
	        this.ranks = this.convertValues(source["ranks"], RankDef);
	        this.categories = this.convertValues(source["categories"], ProgressCategory);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class KovaaksScoreAttributes {
	    fov: number;
	    hash: string;
	    cm360: number;
	    kills: number;
	    score: number;
	    avgFps: number;
	    avgTtk: number;
	    fovScale: string;
	    vertSens: number;
	    horizSens: number;
	    resolution: string;
	    sensScale: string;
	    pauseCount: number;
	    pauseDuration: number;
	    accuracyDamage: number;
	    challengeStart: string;
	    scenarioVersion: string;
	    clientBuildVersion: string;
	    epoch: string;
	
	    static createFrom(source: any = {}) {
	        return new KovaaksScoreAttributes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fov = source["fov"];
	        this.hash = source["hash"];
	        this.cm360 = source["cm360"];
	        this.kills = source["kills"];
	        this.score = source["score"];
	        this.avgFps = source["avgFps"];
	        this.avgTtk = source["avgTtk"];
	        this.fovScale = source["fovScale"];
	        this.vertSens = source["vertSens"];
	        this.horizSens = source["horizSens"];
	        this.resolution = source["resolution"];
	        this.sensScale = source["sensScale"];
	        this.pauseCount = source["pauseCount"];
	        this.pauseDuration = source["pauseDuration"];
	        this.accuracyDamage = source["accuracyDamage"];
	        this.challengeStart = source["challengeStart"];
	        this.scenarioVersion = source["scenarioVersion"];
	        this.clientBuildVersion = source["clientBuildVersion"];
	        this.epoch = source["epoch"];
	    }
	}
	export class KovaaksLastScore {
	    id: string;
	    type: string;
	    attributes: KovaaksScoreAttributes;
	
	    static createFrom(source: any = {}) {
	        return new KovaaksLastScore(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.attributes = this.convertValues(source["attributes"], KovaaksScoreAttributes);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class MousePoint {
	    ts: number;
	    x: number;
	    y: number;
	    buttons?: number;
	
	    static createFrom(source: any = {}) {
	        return new MousePoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ts = source["ts"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.buttons = source["buttons"];
	    }
	}
	
	
	
	export class ScenarioNote {
	    notes: string;
	    sens: string;
	
	    static createFrom(source: any = {}) {
	        return new ScenarioNote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.notes = source["notes"];
	        this.sens = source["sens"];
	    }
	}
	
	export class ScenarioRecord {
	    filePath: string;
	    fileName: string;
	    stats: Record<string, any>;
	    events: string[][];
	    mouseTrace?: MousePoint[];
	    traceData?: string;
	    hasTrace: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ScenarioRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.fileName = source["fileName"];
	        this.stats = source["stats"];
	        this.events = source["events"];
	        this.mouseTrace = this.convertValues(source["mouseTrace"], MousePoint);
	        this.traceData = source["traceData"];
	        this.hasTrace = source["hasTrace"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionNote {
	    name: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionNote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.notes = source["notes"];
	    }
	}
	export class Settings {
	    steamInstallDir: string;
	    steamIdOverride?: string;
	    personaNameOverride?: string;
	    statsDir: string;
	    tracesDir: string;
	    sessionGapMinutes: number;
	    theme: string;
	    font?: string;
	    favoriteBenchmarks?: string[];
	    mouseTrackingEnabled: boolean;
	    mouseBufferMinutes: number;
	    maxExistingOnStart: number;
	    autostartEnabled: boolean;
	    geminiApiKey?: string;
	    scenarioNotes?: Record<string, ScenarioNote>;
	    sessionNotes?: Record<string, SessionNote>;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.steamInstallDir = source["steamInstallDir"];
	        this.steamIdOverride = source["steamIdOverride"];
	        this.personaNameOverride = source["personaNameOverride"];
	        this.statsDir = source["statsDir"];
	        this.tracesDir = source["tracesDir"];
	        this.sessionGapMinutes = source["sessionGapMinutes"];
	        this.theme = source["theme"];
	        this.font = source["font"];
	        this.favoriteBenchmarks = source["favoriteBenchmarks"];
	        this.mouseTrackingEnabled = source["mouseTrackingEnabled"];
	        this.mouseBufferMinutes = source["mouseBufferMinutes"];
	        this.maxExistingOnStart = source["maxExistingOnStart"];
	        this.autostartEnabled = source["autostartEnabled"];
	        this.geminiApiKey = source["geminiApiKey"];
	        this.scenarioNotes = this.convertValues(source["scenarioNotes"], ScenarioNote, true);
	        this.sessionNotes = this.convertValues(source["sessionNotes"], SessionNote, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateInfo {
	    currentVersion: string;
	    latestVersion: string;
	    hasUpdate: boolean;
	    downloadUrl?: string;
	    releaseNotes?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.hasUpdate = source["hasUpdate"];
	        this.downloadUrl = source["downloadUrl"];
	        this.releaseNotes = source["releaseNotes"];
	    }
	}

}


export namespace models {
	
	export class BenchmarkDifficulty {
	    difficultyName: string;
	    kovaaksBenchmarkId: number;
	    sharecode: string;
	    rankColors: Record<string, string>;
	    categories: any[];
	
	    static createFrom(source: any = {}) {
	        return new BenchmarkDifficulty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.difficultyName = source["difficultyName"];
	        this.kovaaksBenchmarkId = source["kovaaksBenchmarkId"];
	        this.sharecode = source["sharecode"];
	        this.rankColors = source["rankColors"];
	        this.categories = source["categories"];
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
	
	export class MousePoint {
	    // Go type: time
	    ts: any;
	    x: number;
	    y: number;
	
	    static createFrom(source: any = {}) {
	        return new MousePoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ts = this.convertValues(source["ts"], null);
	        this.x = source["x"];
	        this.y = source["y"];
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
	export class ScenarioRecord {
	    filePath: string;
	    fileName: string;
	    stats: Record<string, any>;
	    events: string[][];
	    mouseTrace?: MousePoint[];
	
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
	export class Settings {
	    steamInstallDir: string;
	    statsDir: string;
	    tracesDir: string;
	    sessionGapMinutes: number;
	    theme: string;
	    favoriteBenchmarks?: string[];
	    mouseTrackingEnabled: boolean;
	    mouseBufferMinutes: number;
	    maxExistingOnStart: number;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.steamInstallDir = source["steamInstallDir"];
	        this.statsDir = source["statsDir"];
	        this.tracesDir = source["tracesDir"];
	        this.sessionGapMinutes = source["sessionGapMinutes"];
	        this.theme = source["theme"];
	        this.favoriteBenchmarks = source["favoriteBenchmarks"];
	        this.mouseTrackingEnabled = source["mouseTrackingEnabled"];
	        this.mouseBufferMinutes = source["mouseBufferMinutes"];
	        this.maxExistingOnStart = source["maxExistingOnStart"];
	    }
	}

}


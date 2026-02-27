export namespace agent {
	
	export class MetricSnapshot {
	    timestamp: string;
	    activeCount: number;
	    thinkingCount: number;
	    waitingCount: number;
	    idleCount: number;
	
	    static createFrom(source: any = {}) {
	        return new MetricSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.activeCount = source["activeCount"];
	        this.thinkingCount = source["thinkingCount"];
	        this.waitingCount = source["waitingCount"];
	        this.idleCount = source["idleCount"];
	    }
	}
	export class SessionMetrics {
	    sessionId: string;
	    sessionName: string;
	    agent: string;
	    status: string;
	    thinkingTime: number;
	    waitingTime: number;
	    idleTime: number;
	    totalTime: number;
	    lastActivity: string;
	    isStuck: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SessionMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.sessionName = source["sessionName"];
	        this.agent = source["agent"];
	        this.status = source["status"];
	        this.thinkingTime = source["thinkingTime"];
	        this.waitingTime = source["waitingTime"];
	        this.idleTime = source["idleTime"];
	        this.totalTime = source["totalTime"];
	        this.lastActivity = source["lastActivity"];
	        this.isStuck = source["isStuck"];
	    }
	}
	export class DashboardData {
	    sessions: SessionMetrics[];
	    history: MetricSnapshot[];
	    stuckAgents: SessionMetrics[];
	
	    static createFrom(source: any = {}) {
	        return new DashboardData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessions = this.convertValues(source["sessions"], SessionMetrics);
	        this.history = this.convertValues(source["history"], MetricSnapshot);
	        this.stuckAgents = this.convertValues(source["stuckAgents"], SessionMetrics);
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
	

}

export namespace linear {
	
	export class Cycle {
	    id: string;
	    name: string;
	    number: number;
	    startsAt: string;
	    endsAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Cycle(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.number = source["number"];
	        this.startsAt = source["startsAt"];
	        this.endsAt = source["endsAt"];
	    }
	}
	export class Team {
	    id: string;
	    name: string;
	    key: string;
	
	    static createFrom(source: any = {}) {
	        return new Team(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.key = source["key"];
	    }
	}
	export class Label {
	    id: string;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Label(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class User {
	    id: string;
	    name: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.email = source["email"];
	    }
	}
	export class State {
	    id: string;
	    name: string;
	    color: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new State(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	        this.type = source["type"];
	    }
	}
	export class Issue {
	    id: string;
	    identifier: string;
	    title: string;
	    description: string;
	    priority: number;
	    state: State;
	    assignee?: User;
	    labels: Label[];
	    team?: Team;
	    url: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Issue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.identifier = source["identifier"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.priority = source["priority"];
	        this.state = this.convertValues(source["state"], State);
	        this.assignee = this.convertValues(source["assignee"], User);
	        this.labels = this.convertValues(source["labels"], Label);
	        this.team = this.convertValues(source["team"], Team);
	        this.url = source["url"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
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
	export class CycleIssuesResponse {
	    cycle?: Cycle;
	    issues: Issue[];
	    states: State[];
	
	    static createFrom(source: any = {}) {
	        return new CycleIssuesResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cycle = this.convertValues(source["cycle"], Cycle);
	        this.issues = this.convertValues(source["issues"], Issue);
	        this.states = this.convertValues(source["states"], State);
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
	
	
	export class Me {
	    id: string;
	    name: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new Me(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.email = source["email"];
	    }
	}
	
	

}

export namespace session {
	
	export class SessionConfig {
	    name: string;
	    agent: string;
	    directory: string;
	    useWorktree: boolean;
	    worktreePath: string;
	    branch: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.agent = source["agent"];
	        this.directory = source["directory"];
	        this.useWorktree = source["useWorktree"];
	        this.worktreePath = source["worktreePath"];
	        this.branch = source["branch"];
	    }
	}
	export class SessionState {
	    id: string;
	    name: string;
	    agent: string;
	    directory: string;
	    worktreePath: string;
	    branch: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.agent = source["agent"];
	        this.directory = source["directory"];
	        this.worktreePath = source["worktreePath"];
	        this.branch = source["branch"];
	        this.status = source["status"];
	    }
	}

}

export namespace settings {
	
	export class Settings {
	    defaultAgent: string;
	    defaultWorktree: boolean;
	    theme: string;
	    shellPath: string;
	    linearApiKey: string;
	    linearTeamId: string;
	    defaultRepoDir: string;
	    linearOAuthToken: string;
	    linearClientId: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultAgent = source["defaultAgent"];
	        this.defaultWorktree = source["defaultWorktree"];
	        this.theme = source["theme"];
	        this.shellPath = source["shellPath"];
	        this.linearApiKey = source["linearApiKey"];
	        this.linearTeamId = source["linearTeamId"];
	        this.defaultRepoDir = source["defaultRepoDir"];
	        this.linearOAuthToken = source["linearOAuthToken"];
	        this.linearClientId = source["linearClientId"];
	    }
	}

}

export namespace worktree {
	
	export class WorktreeInfo {
	    path: string;
	    branch: string;
	    hash: string;
	
	    static createFrom(source: any = {}) {
	        return new WorktreeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.branch = source["branch"];
	        this.hash = source["hash"];
	    }
	}

}


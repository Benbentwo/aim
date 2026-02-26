export namespace session {
	
	export class SessionConfig {
	    name: string;
	    agent: string;
	    directory: string;
	    useWorktree: boolean;
	    worktreePath: string;
	    branch: string;
	    workspaceId: string;
	
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
	        this.workspaceId = source["workspaceId"];
	    }
	}
	export class SessionState {
	    id: string;
	    workspaceId: string;
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
	        this.workspaceId = source["workspaceId"];
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
	    reposBaseDir: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultAgent = source["defaultAgent"];
	        this.defaultWorktree = source["defaultWorktree"];
	        this.theme = source["theme"];
	        this.shellPath = source["shellPath"];
	        this.reposBaseDir = source["reposBaseDir"];
	    }
	}

}

export namespace workspace {
	
	export class AddWorkspaceConfig {
	    path: string;
	    repoUrl: string;
	    reposBaseDir: string;
	    name: string;
	    agent: string;
	
	    static createFrom(source: any = {}) {
	        return new AddWorkspaceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.repoUrl = source["repoUrl"];
	        this.reposBaseDir = source["reposBaseDir"];
	        this.name = source["name"];
	        this.agent = source["agent"];
	    }
	}
	export class WorkspaceWithSessions {
	    id: string;
	    name: string;
	    path: string;
	    agent: string;
	    cloned: boolean;
	    sessions: session.SessionState[];
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceWithSessions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.agent = source["agent"];
	        this.cloned = source["cloned"];
	        this.sessions = this.convertValues(source["sessions"], session.SessionState);
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

export namespace worktree {
	
	export class RepoURL {
	    host: string;
	    org: string;
	    repo: string;
	
	    static createFrom(source: any = {}) {
	        return new RepoURL(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.org = source["org"];
	        this.repo = source["repo"];
	    }
	}
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


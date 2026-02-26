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
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultAgent = source["defaultAgent"];
	        this.defaultWorktree = source["defaultWorktree"];
	        this.theme = source["theme"];
	        this.shellPath = source["shellPath"];
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


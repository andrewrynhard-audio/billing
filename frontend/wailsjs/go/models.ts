export namespace main {
	
	export class Settings {
	    apiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	    }
	}

}

export namespace stripe {
	
	export class StripeCustomerView {
	    id: string;
	    name: string;
	    email: string;
	    independent: boolean;
	
	    static createFrom(source: any = {}) {
	        return new StripeCustomerView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.email = source["email"];
	        this.independent = source["independent"];
	    }
	}
	export class StripeProductView {
	    id: string;
	    name: string;
	    priceID: string;
	    priceCents: number;
	
	    static createFrom(source: any = {}) {
	        return new StripeProductView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.priceID = source["priceID"];
	        this.priceCents = source["priceCents"];
	    }
	}

}


export function classifyCheckoutRpcError(error: {code?:string;message?:string}): {status:number;code:string;transactionRolledBack:boolean};

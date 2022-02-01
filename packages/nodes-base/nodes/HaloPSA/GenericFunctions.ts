import {
	IExecuteFunctions,
	IHookFunctions,
} from 'n8n-core';

import {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	IDataObject,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

import {
	OptionsWithUri,
} from 'request';

// Interfaces and Types -------------------------------------------------------------
interface IHaloPSATokens {
	scope: string;
	token_type: string;
	access_token: string;
	expires_in: number;
	refresh_token: string;
	id_token: string;
}

// API Requests ---------------------------------------------------------------------

export async function getAccessTokens(
	this: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<IHaloPSATokens> {
	const credentials = (await this.getCredentials('haloPSAApi')) as IDataObject;

	const options: OptionsWithUri = {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		method: 'POST',
		form: {
			client_id: credentials.client_id,
			client_secret: credentials.client_secret,
			grant_type: 'client_credentials',
			scope: credentials.scope,
		},
		uri: getAuthUrl(credentials),
		json: true,
	};

	try {
		const tokens = await this.helpers.request!(options);
		return tokens;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function haloPSAApiRequest(
	this:
		| IHookFunctions
		| IExecuteFunctions
		| IExecuteSingleFunctions
		| ILoadOptionsFunctions
		| IPollFunctions,
	method: string,
	resource: string,
	accessToken: string,
	body: IDataObject | IDataObject[] = {},
	qs: IDataObject = {},
	option: IDataObject = {},
): Promise<IDataObject> {

	const resourceApiUrl = ((await this.getCredentials('haloPSAApi')) as IDataObject)
		.resourceApiUrl as string;

	try {
		let options: OptionsWithUri = {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'User-Agent': 'https://n8n.io',
				Connection: 'keep-alive',
				Accept: '*/*',
				'Accept-Encoding': 'gzip, deflate, br',
				'Content-Type': 'application/json',
			},
			method,
			qs,
			body,
			uri: `${resourceApiUrl}${resource}`,
			json: true,
		};
		options = Object.assign({}, options, option);
		if (Object.keys(body).length === 0) {
			delete options.body;
		}
		console.log(options);
		return await this.helpers.request!(options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function haloPSAApiRequestAllItems(this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	propertyName: string,
	method: string,
	endpoint: string,
	accessToken: string,
	body = {},
	query: IDataObject = {}): Promise<any> { // tslint:disable-line:no-any

	const returnData: IDataObject[] = [];

	let responseData: IDataObject;
	query.page_size = 100;
	query.page_no = 1;
	query.pageinate = true;

	do {
		responseData = await haloPSAApiRequest.call(this, method, endpoint, accessToken, body, query) as IDataObject;
		returnData.push.apply(returnData, responseData[propertyName] as IDataObject[]);
		query.page_no++;
		//@ts-ignore
	} while (returnData.length < responseData.record_count);

	return returnData;
}

// Utilities ------------------------------------------------------------------------

function getAuthUrl(credentials: IDataObject) {
	return credentials.hostingType === 'on-premise'
		? `${credentials.appUrl}/auth/token`
		: `${credentials.authUrl}/token?tenant=${credentials.tenant}`;
}

// Validation -----------------------------------------------------------------------

export async function validateCrendetials(
	this: ICredentialTestFunctions,
	decryptedCredentials: ICredentialDataDecryptedObject,
): Promise<IHaloPSATokens> {
	const credentials = decryptedCredentials;

	const options: OptionsWithUri = {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		method: 'POST',
		form: {
			client_id: credentials.client_id,
			client_secret: credentials.client_secret,
			grant_type: 'client_credentials',
			scope: credentials.scope,
		},
		uri: getAuthUrl(credentials),
		json: true,
	};

	return (await this.helpers.request!(options)) as IHaloPSATokens;
}

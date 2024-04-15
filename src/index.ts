import { GraphQLParams, Plugin, createSchema, createYoga } from 'graphql-yoga';
// import { createYogaHive, useYogaHive } from '@graphql-hive/client';
import { ExecutionArgs } from 'graphql';

export interface Env {}

let requestCount = 0;

function writeCountValue(req: Request) {
	const value = requestCount++;
	req[Symbol.for('requestCount')] = value;

	return value;
}

function getCountValue(req: Request) {
	return req[Symbol.for('requestCount')];
}

function customPlugin(): Plugin {
	const cache = new WeakMap<
		Request,
		{
			paramsArgs: GraphQLParams;
			executionArgs?: ExecutionArgs;
		}
	>();

	return {
		onParams(context) {
			const reqId = getCountValue(context.request);
			console.log('hook:onParams', reqId);

			cache.set(context.request, {
				paramsArgs: context.params,
			});
		},
		onExecute() {
			return {
				onExecuteDone({ args }) {
					console.log('hook:onExecuteDone', getCountValue(args.contextValue.request));
					const record = cache.get(args.contextValue.request);
					if (!record) {
						throw new Error('onExecute.onExecuteDone expected a record');
					}

					record.executionArgs = args;
				},
			};
		},
		onResultProcess(context) {
			console.log('hook:onResultProcess', getCountValue(context.request));
			const record = cache.get(context.request);

			if (!record) {
				throw new Error('onResultProcess expected a record');
			}

			if (Object.keys(record).includes('executionArgs')) {
				console.log('🍺 OK');
			} else {
				console.log('💩 NOT OK');
			}
		},
	};
}

// const hive = createYogaHive({
// 	enabled: true,
// 	debug: true,
// 	printTokenInfo: false,
// 	token: '626b8d0005e70baae842bee892bd66d2',
// 	usage: {
// 		clientInfo() {
// 			return {
// 				name: 'GraphQL Yoga and Cloudflare Worker',
// 				version: '1.0.0',
// 			};
// 		},
// 		exclude: ['IntrospectionQuery'],
// 	},
// 	reporting: false,
// 	autoDispose: false,
// });

const yoga = createYoga({
	schema: createSchema({
		typeDefs: /* GraphQL */ `
			type Query {
				hello: String!
			}
		`,
		resolvers: {
			Query: {
				hello: () => 'Hello World!',
			},
		},
	}),
	plugins: [
		// useYogaHive(hive),
		customPlugin(),
	],
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		console.log('GraphQL start');
		const val = writeCountValue(request);
		console.log('Req ID', val);

		const response = await yoga.fetch(request, env, ctx);

		console.log('GraphQL done');
		// ctx.waitUntil(hive.dispose().then(() => console.log('Hive disposed')));

		return response;
	},
};

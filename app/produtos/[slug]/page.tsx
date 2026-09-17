import { notFound,redirect } from 'next/navigation';
import { getProductCatalog } from '../../../lib/products/repository';
import { ProductPage,productMetadata } from '../../products/ProductPage';
type Props={params:Promise<{slug:string}>};
async function find(slug:string){const p=Object.values(await getProductCatalog()).find(p=>p.href===`/produtos/${slug}`||p.href===`/${slug}`);if(!p?.active)notFound();return p;}
export async function generateMetadata({params}:Props){return productMetadata((await find((await params).slug)).id)}
export default async function Page({params}:Props){const slug=(await params).slug;const p=await find(slug);if(p.href!==`/produtos/${slug}`)redirect(p.href);return <ProductPage id={p.id}/>}

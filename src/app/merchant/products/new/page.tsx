import ProductEdit from "../[id]/page";

export const metadata = { title: "New product" };

export default function NewProduct() {
  return <ProductEdit params={Promise.resolve({ id: "new" })} />;
}

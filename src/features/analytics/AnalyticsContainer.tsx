import Head from 'next/head'
import Container from '../../components/Container'
import AnalyticsMenu from './AnalyticsMenu'

export default function AnalyticsContainer({ children }): JSX.Element {
  return (
    <>
      <Head>
        <title>MetaviceSwap Liquidity Pair (SLP) Analytics | Metavice</title>
        <meta name="description" content="MetaviceSwap Liquidity Pair (SSLP) Analytics by Metavice" />
      </Head>

      <Container
        id="analytics"
        maxWidth="full"
        className="grid h-full grid-flow-col grid-cols-10 px-4 py-4 mx-auto md:py-8 lg:py-12 gap-9"
      >
        <div
          className="sticky top-0 hidden lg:block md:col-span-2 3xl:col-start-2 3xl:col-span-1"
          style={{ maxHeight: '40rem' }}
        >
          <AnalyticsMenu />
        </div>
        <div className="col-span-10 space-y-4 lg:col-span-8 3xl:col-span-7">{children}</div>
      </Container>
    </>
  )
}

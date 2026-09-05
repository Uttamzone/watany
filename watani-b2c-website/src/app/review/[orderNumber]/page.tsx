import {Suspense} from "react";
import {ReviewView} from "./review-view";

export default async function PublicOrderReviewPage({
                                                        params,
                                                    }: {
    params: Promise<{ orderNumber: string }>;
}) {
    const {orderNumber} = await params;

    return (
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
            <ReviewView orderNumber={orderNumber}/>
        </Suspense>
    );
}
